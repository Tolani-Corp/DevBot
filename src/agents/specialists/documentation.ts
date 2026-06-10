import { generateCodeChanges } from "@/ai/claude.js";
import { analyzeFiles } from "@/ai/rag.js";
import { tracer } from "@/lib/tracing.js";
import { logger } from "@/lib/logger.js";
import type { AgentTask, AgentResult } from "../types.js";
import { z } from "zod";

/**
 * Documentation Agent: Auto-generates and updates documentation.
 * 
 * Capabilities:
 * - JSDoc extraction → OpenAPI/Swagger
 * - Architecture diagram generation (Mermaid)
 * - Changelog auto-generation from commits
 * - README section generation
 * - Architecture decision record (ADR) creation
 */

export interface DocGenerationContext {
  files: Record<string, string>;
  type: "openapi" | "architecture" | "changelog" | "readme" | "adr";
  title?: string;
  description?: string;
  commitHistory?: string[];
  existingDocs?: string;
}

const DocGenerationContextSchema = z.object({
  files: z.record(z.string()),
  type: z.enum(["openapi", "architecture", "changelog", "readme", "adr"]),
  title: z.string().optional(),
  description: z.string().optional(),
  commitHistory: z.array(z.string()).optional(),
  existingDocs: z.string().optional(),
});

export async function executeDocumentationTask(
  task: AgentTask,
  context: DocGenerationContext,
): Promise<AgentResult> {
  const span = tracer.startSpan("documentation-agent", {
    attributes: {
      taskId: task.id,
      docType: context.type,
    },
  });

  try {
    // Validate context
    const validContext = DocGenerationContextSchema.parse(context);

    logger.info(`[doc-agent] Starting ${validContext.type} generation`, {
      taskId: task.id,
      docType: validContext.type,
    });

    let generatedDoc: string;

    switch (validContext.type) {
      case "openapi":
        generatedDoc = await generateOpenAPISpec(validContext.files);
        break;
      case "architecture":
        generatedDoc = await generateArchitectureDocs(validContext.files);
        break;
      case "changelog":
        generatedDoc = await generateChangelog(
          validContext.commitHistory || [],
          validContext.existingDocs,
        );
        break;
      case "readme":
        generatedDoc = await generateREADME(
          validContext.files,
          validContext.existingDocs,
        );
        break;
      case "adr":
        generatedDoc = await generateADR(
          validContext.title || "Architecture Decision",
          validContext.description || "",
          validContext.files,
        );
        break;
    }

    // Analyze files for context-awareness
    const fileAnalysis = await analyzeFiles(Object.values(validContext.files));

    const result: AgentResult = {
      success: true,
      output: generatedDoc,
      changes: [
        {
          file: `docs/${validContext.type}-${Date.now()}.md`,
          content: generatedDoc,
          explanation: `Generated ${validContext.type} documentation from codebase analysis`,
        },
      ],
    };

    logger.info(`[doc-agent] Successfully generated ${validContext.type}`, {
      taskId: task.id,
      outputLength: generatedDoc.length,
    });

    span.end();
    return result;
  } catch (error) {
    logger.error(`[doc-agent] Task failed`, {
      taskId: task.id,
      error: error instanceof Error ? error.message : String(error),
    });

    span.recordException(error instanceof Error ? error : new Error(String(error)));
    span.end();

    return {
      success: false,
      output: `Documentation generation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Generate OpenAPI/Swagger spec from TypeScript/Express handlers
 */
async function generateOpenAPISpec(files: Record<string, string>): Promise<string> {
  const prompt = `
Analyze the provided source files and generate a comprehensive OpenAPI 3.0 specification.

Extract:
1. All REST endpoints (GET, POST, PUT, DELETE, PATCH)
2. Request/response schemas
3. Error responses (400, 401, 403, 404, 500)
4. Authentication/authorization
5. Path parameters, query parameters, headers
6. Content types (application/json, etc.)

Generate a valid OpenAPI 3.0 YAML specification.

Source files:
${Object.entries(files)
  .map(([path, content]) => `## ${path}\n\`\`\`\n${content}\n\`\`\``)
  .join("\n\n")}
`;

  const spec = await generateCodeChanges(prompt, {
    filesContents: files,
  });

  return `# OpenAPI 3.0 Specification\n\n${spec.plan}`;
}

/**
 * Generate architecture diagrams and docs (Mermaid)
 */
async function generateArchitectureDocs(files: Record<string, string>): Promise<string> {
  const prompt = `
Analyze the codebase and generate comprehensive architecture documentation with Mermaid diagrams.

Create:
1. System architecture diagram (component relationships)
2. Data flow diagram
3. Deployment architecture
4. Module dependency graph
5. Architecture decision document

Include:
- Component responsibilities
- Data storage patterns
- Integration points
- Scalability considerations

Generate documentation with embedded Mermaid diagrams using this syntax:
\`\`\`mermaid
graph TD
  A[Component] --> B[Component]
\`\`\`

Source files:
${Object.entries(files)
  .map(([path, content]) => `## ${path}\n\`\`\`ts\n${content.slice(0, 500)}...\n\`\`\``)
  .join("\n\n")}
`;

  const docs = await generateCodeChanges(prompt, {
    filesContents: files,
  });

  return `# Architecture Documentation\n\n${docs.plan}`;
}

/**
 * Generate CHANGELOG from commit history
 */
async function generateChangelog(
  commits: string[],
  existingChangelog?: string,
): Promise<string> {
  const prompt = `
Generate a professional CHANGELOG.md from the commit history.

Format:
- Group commits by type: Features, Bug Fixes, Performance, Breaking Changes, Docs
- Use semantic versioning (major.minor.patch)
- Include commit dates
- Link to commit SHAs if available
- Highlight breaking changes prominently

Commits:
${commits.map((c) => `- ${c}`).join("\n")}

${existingChangelog ? `\nExisting changelog structure:\n${existingChangelog}` : ""}

Generate professional CHANGELOG.md content.
`;

  const changelog = await generateCodeChanges(prompt, {
    filesContents: { "CHANGELOG.md": existingChangelog || "" },
  });

  return changelog.plan;
}

/**
 * Generate or update README
 */
async function generateREADME(
  files: Record<string, string>,
  existingReadme?: string,
): Promise<string> {
  const prompt = `
Generate or update a comprehensive README.md for this project.

Include sections:
1. Project title and description
2. Key features
3. Quick start / Installation
4. Usage examples
5. API reference (if applicable)
6. Architecture overview (brief)
7. Development setup
8. Testing instructions
9. Contribution guidelines
10. License

Analyze the codebase to extract:
- Project purpose and features
- Dependencies and tech stack
- Configuration options

Source files summary:
${Object.keys(files)
  .slice(0, 10)
  .map((f) => `- ${f}`)
  .join("\n")}

${existingReadme ? `\nExisting README:\n${existingReadme.slice(0, 500)}...` : ""}

Generate a professional README.md.
`;

  const readme = await generateCodeChanges(prompt, {
    filesContents: files,
  });

  return readme.plan;
}

/**
 * Generate Architecture Decision Record (ADR)
 */
async function generateADR(
  title: string,
  description: string,
  files: Record<string, string>,
): Promise<string> {
  const prompt = `
Generate a formal Architecture Decision Record (ADR) following the Markdown Architectural Decision Records (MADR) format.

Title: ${title}
Context: ${description}

ADR Format:
# ${title}

## Context
[Problem statement]

## Decision
[Architecture decision made]

## Consequences
- Positive: [Benefits]
- Negative: [Trade-offs]

## Alternatives Considered
[Other options evaluated]

## Related
[Related ADRs, decisions]

Generate a complete ADR based on the codebase and decision context provided.

Source files:
${Object.entries(files)
  .map(([path, content]) => `## ${path}\n\`\`\`\n${content.slice(0, 300)}...\n\`\`\``)
  .join("\n\n")}
`;

  const adr = await generateCodeChanges(prompt, {
    filesContents: files,
  });

  return adr.plan;
}
