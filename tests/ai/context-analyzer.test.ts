import { describe, it, expect, beforeEach } from "vitest";
import {
  extractProjectContext,
  detectNamingConventions,
  detectStyleGuide,
  buildContextualPrompt,
} from "@/ai/context-analyzer.js";

describe("Context Analyzer", () => {
  const mockFiles = {
    "src/utils.ts": "export function getUserById(id: string) { return db.get(id); }",
    "src/models.ts": "export class User { public name: string; }",
  };

  it("should detect naming conventions", () => {
    const conventions = detectNamingConventions(mockFiles);
    expect(conventions).toHaveProperty("variables");
    expect(conventions).toHaveProperty("functions");
    expect(conventions).toHaveProperty("classes");
  });

  it("should detect style guide", () => {
    const style = detectStyleGuide(mockFiles);
    expect(style).toHaveProperty("formatting");
    expect(style).toHaveProperty("naming");
  });

  it("should extract complete project context", async () => {
    const context = await extractProjectContext("test-project", mockFiles);
    expect(context).toHaveProperty("projectName");
    expect(context).toHaveProperty("conventions");
    expect(context).toHaveProperty("style");
    expect(context).toHaveProperty("patterns");
  });

  it("should build contextual prompts", async () => {
    const context = await extractProjectContext("test-project", mockFiles);
    const prompt = buildContextualPrompt("Generate a function", context);
    expect(prompt).toContain("STYLE GUIDE");
    expect(prompt).toContain("Generate a function");
  });
});
