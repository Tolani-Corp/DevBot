import { generateCodeChanges } from "@/ai/claude.js";
import { analyzeFiles } from "@/ai/rag.js";
import { tracer } from "@/lib/tracing.js";
import { logger } from "@/lib/logger.js";
import type { AgentTask, AgentResult } from "../types.js";
import { z } from "zod";

/**
 * Test Generation Agent: Auto-generates unit, integration, and E2E tests.
 * 
 * Capabilities:
 * - Unit test generation (Vitest)
 * - Integration test scaffolding
 * - E2E test generation (Playwright)
 * - Test data factories
 * - Mutation testing analysis
 */

export interface TestGenerationContext {
  sourceFile: string;
  sourceCode: string;
  testType: "unit" | "integration" | "e2e" | "factory";
  existingTests?: string;
  coverage?: string;
}

const TestGenerationContextSchema = z.object({
  sourceFile: z.string(),
  sourceCode: z.string(),
  testType: z.enum(["unit", "integration", "e2e", "factory"]),
  existingTests: z.string().optional(),
  coverage: z.string().optional(),
});

export async function executeTestGenerationTask(
  task: AgentTask,
  context: TestGenerationContext,
): Promise<AgentResult> {
  const span = tracer.startSpan("test-generator-agent", {
    attributes: {
      taskId: task.id,
      sourceFile: context.sourceFile,
      testType: context.testType,
    },
  });

  try {
    const validContext = TestGenerationContextSchema.parse(context);

    logger.info(`[test-agent] Generating ${validContext.testType} tests`, {
      taskId: task.id,
      sourceFile: validContext.sourceFile,
      testType: validContext.testType,
    });

    let generatedTests: string;
    const testFilename = validContext.sourceFile.replace(/\.ts$/, `.test.ts`);

    switch (validContext.testType) {
      case "unit":
        generatedTests = await generateUnitTests(
          validContext.sourceFile,
          validContext.sourceCode,
          validContext.existingTests,
        );
        break;
      case "integration":
        generatedTests = await generateIntegrationTests(
          validContext.sourceFile,
          validContext.sourceCode,
          validContext.existingTests,
        );
        break;
      case "e2e":
        generatedTests = await generateE2ETests(
          validContext.sourceFile,
          validContext.sourceCode,
          validContext.existingTests,
        );
        break;
      case "factory":
        generatedTests = await generateTestFactory(
          validContext.sourceFile,
          validContext.sourceCode,
        );
        break;
    }

    const result: AgentResult = {
      success: true,
      output: generatedTests,
      changes: [
        {
          file: testFilename,
          content: generatedTests,
          explanation: `Generated ${validContext.testType} tests with comprehensive coverage`,
        },
      ],
    };

    logger.info(`[test-agent] Successfully generated tests`, {
      taskId: task.id,
      testType: validContext.testType,
      testCount: (generatedTests.match(/it\(|test\(/g) || []).length,
    });

    span.end();
    return result;
  } catch (error) {
    logger.error(`[test-agent] Task failed`, {
      taskId: task.id,
      error: error instanceof Error ? error.message : String(error),
    });

    span.recordException(error instanceof Error ? error : new Error(String(error)));
    span.end();

    return {
      success: false,
      output: `Test generation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Generate comprehensive unit tests
 */
async function generateUnitTests(
  sourceFile: string,
  sourceCode: string,
  existingTests?: string,
): Promise<string> {
  const prompt = `
Generate comprehensive unit tests for this TypeScript module using Vitest.

Requirements:
1. Test all exported functions and classes
2. Include happy path and error cases
3. Mock external dependencies
4. Test edge cases (null, undefined, empty, large inputs)
5. Achieve >80% code coverage
6. Use descriptive test names
7. Group tests with describe blocks
8. Include setup/teardown if needed

Test framework: Vitest
Mocking: vi.mock()
Use path aliases: @/ for imports

Source file (${sourceFile}):
\`\`\`ts
${sourceCode}
\`\`\`

${existingTests ? `\nExisting tests to extend:\n\`\`\`ts\n${existingTests}\n\`\`\`` : ""}

Generate a complete, production-ready test file.
`;

  const tests = await generateCodeChanges(prompt, {
    filesContents: { [sourceFile]: sourceCode },
  });

  return `import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as module from "@/${sourceFile.replace(/^src\//, "")}";

${tests.plan}`;
}

/**
 * Generate integration tests
 */
async function generateIntegrationTests(
  sourceFile: string,
  sourceCode: string,
  existingTests?: string,
): Promise<string> {
  const prompt = `
Generate integration tests for this module using Vitest.

Requirements:
1. Test interactions between multiple modules
2. Use test database fixtures (mock or real)
3. Test API endpoints with HTTP clients
4. Mock external services
5. Test database transactions and rollbacks
6. Clean up test data between tests
7. Test error handling and recovery

Source file (${sourceFile}):
\`\`\`ts
${sourceCode}
\`\`\`

${existingTests ? `\nExisting tests:\n\`\`\`ts\n${existingTests}\n\`\`\`` : ""}

Generate integration tests that verify end-to-end functionality.
`;

  const tests = await generateCodeChanges(prompt, {
    filesContents: { [sourceFile]: sourceCode },
  });

  return `import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { db } from "@/database";
import * as module from "@/${sourceFile.replace(/^src\//, "")}";

${tests.plan}`;
}

/**
 * Generate E2E tests using Playwright
 */
async function generateE2ETests(
  sourceFile: string,
  sourceCode: string,
  existingTests?: string,
): Promise<string> {
  const prompt = `
Generate end-to-end tests using Playwright for this application module.

Requirements:
1. Test complete user workflows
2. Navigate pages and interact with UI
3. Verify data persistence
4. Test responsive behavior
5. Test error states and recovery
6. Use page objects pattern
7. Include screenshots on failure
8. Test accessibility

Source file (${sourceFile}):
\`\`\`ts
${sourceCode}
\`\`\`

${existingTests ? `\nExisting E2E tests:\n\`\`\`ts\n${existingTests}\n\`\`\`` : ""}

Generate E2E tests using Playwright.
`;

  const tests = await generateCodeChanges(prompt, {
    filesContents: { [sourceFile]: sourceCode },
  });

  return `import { test, expect, Page } from "@playwright/test";

${tests.plan}`;
}

/**
 * Generate test data factory
 */
async function generateTestFactory(sourceFile: string, sourceCode: string): Promise<string> {
  const prompt = `
Generate a test data factory for this module.

Requirements:
1. Factory functions for each entity/interface
2. Sensible defaults for all fields
3. Support for partial/override patterns
4. Handle relationships between entities
5. Generate valid random data
6. Include bulk generation helpers

Source file (${sourceFile}):
\`\`\`ts
${sourceCode}
\`\`\`

Generate a factory.ts file with:
- Factory functions for each type
- Builders with sensible defaults
- Batch/bulk generators
- Examples showing usage
`;

  const factory = await generateCodeChanges(prompt, {
    filesContents: { [sourceFile]: sourceCode },
  });

  return `import { faker } from "@faker-js/faker";

${factory.plan}`;
}
