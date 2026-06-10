import { generateCodeChanges } from "../claude.js";
import { tracer } from "@/lib/tracing.js";
import { logger } from "@/lib/logger.js";

/**
 * Context-Aware Code Generation: Extracts project conventions,
 * style guides, and patterns, then injects them into code generation.
 */

export interface ProjectContext {
  projectName: string;
  description: string;
  conventions: CodeConvention[];
  style: StyleGuide;
  patterns: Pattern[];
}

export interface CodeConvention {
  area: string;
  rule: string;
  examples: string[];
}

export interface StyleGuide {
  naming: NamingConvention;
  formatting: FormattingRules;
  errorHandling: ErrorHandlingPattern;
  testing: TestingConvention;
}

export interface NamingConvention {
  variables: string;
  functions: string;
  classes: string;
  constants: string;
  files: string;
}

export interface FormattingRules {
  indentation: number;
  lineLength: number;
  imports: "alphabetical" | "grouped" | "mixed";
  semicolons: boolean;
  quotes: "single" | "double" | "backtick";
}

export interface ErrorHandlingPattern {
  throwErrors: boolean;
  returnErrors: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
  customErrorClasses: string[];
}

export interface TestingConvention {
  framework: string;
  naming: string;
  coverage: number;
  mocking: string;
}

export interface Pattern {
  name: string;
  example: string;
  usage: string;
}

/**
 * Detect project naming conventions
 */
export function detectNamingConventions(files: Record<string, string>): NamingConvention {
  const conventions: NamingConvention = {
    variables: "camelCase",
    functions: "camelCase",
    classes: "PascalCase",
    constants: "UPPER_SNAKE_CASE",
    files: "kebab-case",
  };

  // Analyze actual code for patterns
  const variableMatches = Object.values(files)
    .join("\n")
    .match(/(?:let|const)\s+(\w+)/g) || [];

  const isSnakeCase = variableMatches.some((m) => /_/.test(m));
  if (isSnakeCase) {
    conventions.variables = "snake_case";
  }

  return conventions;
}

/**
 * Detect code style preferences
 */
export function detectStyleGuide(files: Record<string, string>): StyleGuide {
  const content = Object.values(files).join("\n");

  // Detect semicolons
  const hasSemicolons = content.match(/;\s*\n/).length > content.match(/\s*\n/).length * 0.5;

  // Detect quotes
  let quotes: "single" | "double" | "backtick" = "double";
  if (content.match(/'[^']*'/g).length > content.match(/"[^"]*"/g).length) {
    quotes = "single";
  }

  // Detect indentation
  let indentation = 2;
  const fourSpaceMatches = content.match(/\n    /g) || [];
  const twoSpaceMatches = content.match(/\n  /g) || [];
  if (fourSpaceMatches.length > twoSpaceMatches.length) {
    indentation = 4;
  }

  return {
    naming: detectNamingConventions(files),
    formatting: {
      indentation,
      lineLength: 100,
      imports: "grouped",
      semicolons: hasSemicolons,
      quotes,
    },
    errorHandling: {
      throwErrors: true,
      returnErrors: false,
      logLevel: "info",
      customErrorClasses: ["ValidationError", "NotFoundError"],
    },
    testing: {
      framework: "vitest",
      naming: "*.test.ts",
      coverage: 80,
      mocking: "vi.mock()",
    },
  };
}

/**
 * Detect common patterns in codebase
 */
export function detectPatterns(files: Record<string, string>): Pattern[] {
  const patterns: Pattern[] = [];
  const content = Object.values(files).join("\n");

  // Detect error handling pattern
  if (content.includes("try {")) {
    patterns.push({
      name: "Try-Catch Error Handling",
      example: "try { ... } catch (error) { ... }",
      usage: "All async operations wrap errors",
    });
  }

  // Detect async/await
  if (content.includes("async ") && content.includes("await ")) {
    patterns.push({
      name: "Async/Await",
      example: "async function handler() { await operation(); }",
      usage: "Asynchronous operations",
    });
  }

  // Detect dependency injection
  if (content.includes("constructor(") && content.includes("private ")) {
    patterns.push({
      name: "Constructor Dependency Injection",
      example: "constructor(private service: Service) {}",
      usage: "Dependency management",
    });
  }

  return patterns;
}

/**
 * Extract full project context
 */
export async function extractProjectContext(
  projectName: string,
  files: Record<string, string>,
): Promise<ProjectContext> {
  const span = tracer.startSpan("extract-project-context", {
    attributes: { projectName },
  });

  try {
    const style = detectStyleGuide(files);
    const patterns = detectPatterns(files);

    // Analyze conventions
    const conventions: CodeConvention[] = [
      {
        area: "Imports",
        rule: "Group imports by type: external, internal, relative",
        examples: ['import express from "express";', 'import { handler } from "@/services";'],
      },
      {
        area: "Error Handling",
        rule: "Always return typed errors",
        examples: ['throw new ValidationError("Invalid input");'],
      },
      {
        area: "Testing",
        rule: "Name tests descriptively with it() blocks",
        examples: ['it("should return user when id exists", async () => {']);
      },
    ];

    const context: ProjectContext = {
      projectName,
      description: `Project context extracted for ${projectName}`,
      conventions,
      style,
      patterns,
    };

    logger.info("Project context extracted", {
      projectName,
      patterns: patterns.length,
      conventions: conventions.length,
    });

    span.end();
    return context;
  } catch (error) {
    logger.error("Failed to extract project context", { error });
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    span.end();

    return {
      projectName,
      description: "",
      conventions: [],
      style: {
        naming: {
          variables: "camelCase",
          functions: "camelCase",
          classes: "PascalCase",
          constants: "UPPER_SNAKE_CASE",
          files: "kebab-case",
        },
        formatting: {
          indentation: 2,
          lineLength: 100,
          imports: "grouped",
          semicolons: true,
          quotes: "double",
        },
        errorHandling: {
          throwErrors: true,
          returnErrors: false,
          logLevel: "info",
          customErrorClasses: [],
        },
        testing: {
          framework: "vitest",
          naming: "*.test.ts",
          coverage: 80,
          mocking: "vi.mock()",
        },
      },
      patterns: [],
    };
  }
}

/**
 * Generate context-injected prompt for code generation
 */
export function buildContextualPrompt(
  basePrompt: string,
  context: ProjectContext,
): string {
  const styleSection = `
STYLE GUIDE:
- Naming: Variables ${context.style.naming.variables}, Functions ${context.style.naming.functions}, Classes ${context.style.naming.classes}
- Indentation: ${context.style.formatting.indentation} spaces
- Imports: ${context.style.formatting.imports}
- Use ${context.style.formatting.quotes} quotes
- ${context.style.formatting.semicolons ? "Include" : "Omit"} semicolons
- Framework: ${context.style.testing.framework}
`;

  const patternSection =
    context.patterns.length > 0
      ? `
COMMON PATTERNS IN THIS PROJECT:
${context.patterns.map((p) => `- ${p.name}: ${p.usage}`).join("\n")}
`
      : "";

  const conventionSection =
    context.conventions.length > 0
      ? `
CODE CONVENTIONS:
${context.conventions.map((c) => `- ${c.area}: ${c.rule}`).join("\n")}
`
      : "";

  return `${basePrompt}

${styleSection}
${patternSection}
${conventionSection}

IMPORTANT: Follow all style guide, pattern, and convention requirements strictly.
`;
}
