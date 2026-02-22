import { describe, it, expect, beforeEach } from "vitest";
import { TraceVisualizer } from "@/reasoning/visualizer";
import { TraceCapture } from "@/reasoning/trace";

describe("TraceVisualizer", () => {
  let capture: TraceCapture;
  let visualizer: TraceVisualizer;

  beforeEach(() => {
    capture = new TraceCapture("test-task-visualizer", "security");
    capture.thought("Analyzing security vulnerabilities", { confidence: 0.9 });
    capture.action("Running security scan", {
      alternatives: ["Use tool A", "Use tool B"],
      metadata: { tool: "semgrep" },
    });
    capture.observation("Found 3 potential issues");
    capture.reflection("Should prioritize XSS fixes", { confidence: 0.8 });
    capture.complete(true, "Security scan completed");

    visualizer = new TraceVisualizer(capture.getTrace());
  });

  describe("toMarkdown", () => {
    it("should generate valid markdown", () => {
      const markdown = visualizer.toMarkdown();

      expect(markdown).toContain("# 🧠 Reasoning Trace");
      expect(markdown).toContain("**Task ID:** `test-task-visualizer`");
      expect(markdown).toContain("**Agent:** security");
      expect(markdown).toContain("**Success:** ✅");
      expect(markdown).toContain("**Final Decision:** Security scan completed");
    });

    it("should include statistics table", () => {
      const markdown = visualizer.toMarkdown();

      expect(markdown).toContain("## 📊 Statistics");
      expect(markdown).toContain("| Total Steps | 4 |");
      expect(markdown).toContain("| Thoughts | 1 |");
      expect(markdown).toContain("| Actions | 1 |");
      expect(markdown).toContain("| Observations | 1 |");
      expect(markdown).toContain("| Reflections | 1 |");
    });

    it("should include average confidence when present", () => {
      const markdown = visualizer.toMarkdown();

      expect(markdown).toContain("| Avg Confidence |");
      expect(markdown).toMatch(/\d+%/);
    });

    it("should use collapsible details for timeline", () => {
      const markdown = visualizer.toMarkdown();

      expect(markdown).toContain("<details>");
      expect(markdown).toContain("</details>");
      expect(markdown).toContain("<summary>");
      expect(markdown).toContain("</summary>");
    });

    it("should show confidence bars", () => {
      const markdown = visualizer.toMarkdown();

      expect(markdown).toContain("**Confidence:**");
      expect(markdown).toMatch(/[█░]+\s+\d+%/);
    });

    it("should show alternatives when present", () => {
      const markdown = visualizer.toMarkdown();

      expect(markdown).toContain("**Alternatives considered:**");
      expect(markdown).toContain("- Use tool A");
      expect(markdown).toContain("- Use tool B");
    });

    it("should show metadata when present", () => {
      const markdown = visualizer.toMarkdown();

      expect(markdown).toContain("**Metadata:**");
      expect(markdown).toContain("```json");
      expect(markdown).toContain('"tool": "semgrep"');
    });

    it("should include step emojis", () => {
      const markdown = visualizer.toMarkdown();

      expect(markdown).toContain("💭"); // thought
      expect(markdown).toContain("⚡"); // action
      expect(markdown).toContain("👁️"); // observation
      expect(markdown).toContain("🔄"); // reflection
    });
  });

  describe("toSlackBlocks", () => {
    it("should generate valid Slack Block Kit JSON", () => {
      const blocks = visualizer.toSlackBlocks();

      expect(Array.isArray(blocks)).toBe(true);
      expect(blocks.length).toBeGreaterThan(0);
    });

    it("should include header block", () => {
      const blocks = visualizer.toSlackBlocks();
      const header = blocks.find((b: any) => b.type === "header");

      expect(header).toBeDefined();
      expect(header).toMatchObject({
        type: "header",
        text: {
          type: "plain_text",
          text: "🧠 Reasoning Trace",
        },
      });
    });

    it("should include task metadata section", () => {
      const blocks = visualizer.toSlackBlocks();
      const section = blocks.find(
        (b: any) => b.type === "section" && b.fields
      );

      expect(section).toBeDefined();
      expect(section.fields).toContainEqual(
        expect.objectContaining({
          type: "mrkdwn",
          text: expect.stringContaining("test-task-visualizer"),
        })
      );
    });

    it("should include divider", () => {
      const blocks = visualizer.toSlackBlocks();
      const divider = blocks.find((b: any) => b.type === "divider");

      expect(divider).toBeDefined();
    });

    it("should limit steps to avoid block limit", () => {
      // Create trace with many steps
      const bigCapture = new TraceCapture("big-task");
      for (let i = 0; i < 20; i++) {
        bigCapture.thought(`Step ${i}`);
      }

      const bigVisualizer = new TraceVisualizer(bigCapture.getTrace());
      const blocks = bigVisualizer.toSlackBlocks();

      // Should have truncation message
      const contextBlock = blocks.find((b: any) => b.type === "context");
      expect(contextBlock).toBeDefined();
      expect(contextBlock.elements[0].text).toContain("and");
      expect(contextBlock.elements[0].text).toContain("more steps");
    });
  });

  describe("toDiscordEmbed", () => {
    it("should generate valid Discord embed object", () => {
      const embed = visualizer.toDiscordEmbed();

      expect(embed).toHaveProperty("title");
      expect(embed).toHaveProperty("description");
      expect(embed).toHaveProperty("color");
      expect(embed).toHaveProperty("fields");
      expect(embed).toHaveProperty("footer");
      expect(embed).toHaveProperty("timestamp");
    });

    it("should have correct title", () => {
      const embed = visualizer.toDiscordEmbed();

      expect(embed.title).toBe("🧠 Reasoning Trace");
    });

    it("should use green color for success", () => {
      const embed = visualizer.toDiscordEmbed();

      expect(embed.color).toBe(0x00ff00); // Green
    });

    it("should use red color for failure", () => {
      const failCapture = new TraceCapture("fail-task");
      failCapture.thought("Attempting task");
      failCapture.complete(false);

      const failVisualizer = new TraceVisualizer(failCapture.getTrace());
      const embed = failVisualizer.toDiscordEmbed();

      expect(embed.color).toBe(0xff0000); // Red
    });

    it("should include task metadata fields", () => {
      const embed = visualizer.toDiscordEmbed();

      const taskIdField = embed.fields.find(f => f.name === "Task ID");
      expect(taskIdField).toBeDefined();
      expect(taskIdField?.value).toContain("test-task-visualizer");

      const agentField = embed.fields.find(f => f.name === "Agent");
      expect(agentField).toBeDefined();
      expect(agentField?.value).toBe("security");

      const successField = embed.fields.find(f => f.name === "Success");
      expect(successField).toBeDefined();
      expect(successField?.value).toContain("✅");
    });

    it("should truncate long step content", () => {
      const longCapture = new TraceCapture("long-task");
      longCapture.thought("A".repeat(300));

      const longVisualizer = new TraceVisualizer(longCapture.getTrace());
      const embed = longVisualizer.toDiscordEmbed();

      const stepField = embed.fields.find(f => f.name.includes("THOUGHT"));
      expect(stepField?.value.length).toBeLessThanOrEqual(210); // 200 + "..."
      expect(stepField?.value).toContain("...");
    });
  });

  describe("toMermaidDiagram", () => {
    it("should generate valid Mermaid syntax", () => {
      const diagram = visualizer.toMermaidDiagram();

      expect(diagram).toContain("```mermaid");
      expect(diagram).toContain("graph TD");
      expect(diagram).toContain("```");
    });

    it("should include start and end nodes", () => {
      const diagram = visualizer.toMermaidDiagram();

      expect(diagram).toContain("Start[Task test-task-visualizer]");
      expect(diagram).toContain("End[✅ Success]");
    });

    it("should show failed end node for failures", () => {
      const failCapture = new TraceCapture("fail-task");
      failCapture.complete(false);

      const failVisualizer = new TraceVisualizer(failCapture.getTrace());
      const diagram = failVisualizer.toMermaidDiagram();

      expect(diagram).toContain("End[❌ Failed]");
      expect(diagram).toContain("fill:#f99");
    });

    it("should create nodes for each step", () => {
      const diagram = visualizer.toMermaidDiagram();

      expect(diagram).toContain("S0"); // Step 0
      expect(diagram).toContain("S1"); // Step 1
      expect(diagram).toContain("S2"); // Step 2
      expect(diagram).toContain("S3"); // Step 3
    });

    it("should use different shapes for different step types", () => {
      const diagram = visualizer.toMermaidDiagram();

      expect(diagram).toContain("("); // Round for thought
      expect(diagram).toContain("["); // Rectangle for action
      expect(diagram).toContain("{"); // Diamond for observation
      expect(diagram).toContain("[["); // Subroutine for reflection
    });

    it("should show alternatives as branches", () => {
      const diagram = visualizer.toMermaidDiagram();

      expect(diagram).toContain("A1_0"); // Alternative node
      expect(diagram).toContain("Alt: Use tool A");
      expect(diagram).toContain("-.->"); // Dotted line for alternative
      expect(diagram).toContain("stroke-dasharray");
    });

    it("should color nodes based on confidence", () => {
      const diagram = visualizer.toMermaidDiagram();

      expect(diagram).toContain("fill:#9f9"); // High confidence (green)
    });

    it("should connect nodes sequentially", () => {
      const diagram = visualizer.toMermaidDiagram();

      expect(diagram).toContain("Start --> S0");
      expect(diagram).toContain("S0 --> S1");
      expect(diagram).toContain("S1 --> S2");
      expect(diagram).toContain("S2 --> S3");
      expect(diagram).toContain("S3 --> End");
    });
  });
});
