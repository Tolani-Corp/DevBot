import type { ReasoningTrace, ReasoningStep, ReasoningStepType } from "./trace.js";

/**
 * Visualizer for reasoning traces - formats for different platforms.
 */
export class TraceVisualizer {
  constructor(private trace: ReasoningTrace) {}

  /**
   * Format as Markdown with collapsible sections.
   */
  toMarkdown(): string {
    const lines: string[] = [];

    // Header
    lines.push(`# 🧠 Reasoning Trace`);
    lines.push("");
    lines.push(`**Task ID:** \`${this.trace.taskId}\``);
    if (this.trace.agentRole) {
      lines.push(`**Agent:** ${this.trace.agentRole}`);
    }
    lines.push(`**Started:** ${this.trace.startedAt.toLocaleString()}`);
    if (this.trace.completedAt) {
      const duration = this.trace.completedAt.getTime() - this.trace.startedAt.getTime();
      lines.push(`**Duration:** ${formatDuration(duration)}`);
    }
    lines.push(`**Success:** ${this.trace.success ? "✅" : "❌"}`);
    if (this.trace.finalDecision) {
      lines.push(`**Final Decision:** ${this.trace.finalDecision}`);
    }
    lines.push("");

    // Statistics
    const thoughtCount = this.trace.steps.filter(s => s.type === "thought").length;
    const actionCount = this.trace.steps.filter(s => s.type === "action").length;
    const observationCount = this.trace.steps.filter(s => s.type === "observation").length;
    const reflectionCount = this.trace.steps.filter(s => s.type === "reflection").length;

    lines.push(`## 📊 Statistics`);
    lines.push("");
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total Steps | ${this.trace.totalSteps} |`);
    lines.push(`| Thoughts | ${thoughtCount} |`);
    lines.push(`| Actions | ${actionCount} |`);
    lines.push(`| Observations | ${observationCount} |`);
    lines.push(`| Reflections | ${reflectionCount} |`);

    const avgConfidence = this.calculateAverageConfidence();
    if (avgConfidence !== null) {
      lines.push(`| Avg Confidence | ${(avgConfidence * 100).toFixed(0)}% |`);
    }
    lines.push("");

    // Timeline
    lines.push(`## ⏱️ Timeline`);
    lines.push("");

    for (const step of this.trace.steps) {
      const relativeTime = step.timestamp.getTime() - this.trace.startedAt.getTime();
      const emoji = getStepEmoji(step.type);
      
      lines.push(`<details>`);
      lines.push(`<summary>${emoji} <strong>${step.type.toUpperCase()}</strong> (+${relativeTime}ms)</summary>`);
      lines.push("");
      lines.push(`${step.content}`);
      lines.push("");

      if (step.confidence !== undefined) {
        const confidenceBar = generateConfidenceBar(step.confidence);
        lines.push(`**Confidence:** ${confidenceBar} ${(step.confidence * 100).toFixed(0)}%`);
        lines.push("");
      }

      if (step.alternatives && step.alternatives.length > 0) {
        lines.push(`**Alternatives considered:**`);
        for (const alt of step.alternatives) {
          lines.push(`- ${alt}`);
        }
        lines.push("");
      }

      if (step.metadata && Object.keys(step.metadata).length > 0) {
        lines.push(`**Metadata:**`);
        lines.push("```json");
        lines.push(JSON.stringify(step.metadata, null, 2));
        lines.push("```");
        lines.push("");
      }

      lines.push(`</details>`);
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Format as Slack Block Kit.
   */
  toSlackBlocks(): unknown[] {
    const blocks: unknown[] = [];

    // Header
    blocks.push({
      type: "header",
      text: {
        type: "plain_text",
        text: "🧠 Reasoning Trace",
      },
    });

    blocks.push({
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Task ID:*\n\`${this.trace.taskId}\``,
        },
        {
          type: "mrkdwn",
          text: `*Agent:*\n${this.trace.agentRole || "N/A"}`,
        },
        {
          type: "mrkdwn",
          text: `*Started:*\n${this.trace.startedAt.toLocaleString()}`,
        },
        {
          type: "mrkdwn",
          text: `*Success:*\n${this.trace.success ? "✅ Yes" : "❌ No"}`,
        },
      ],
    });

    if (this.trace.finalDecision) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Final Decision:* ${this.trace.finalDecision}`,
        },
      });
    }

    blocks.push({ type: "divider" });

    // Steps (limited to avoid block limit)
    const maxSteps = 10;
    const steps = this.trace.steps.slice(0, maxSteps);

    for (const step of steps) {
      const emoji = getStepEmoji(step.type);
      let text = `${emoji} *${step.type.toUpperCase()}*\n${step.content}`;

      if (step.confidence !== undefined) {
        text += `\n_Confidence: ${(step.confidence * 100).toFixed(0)}%_`;
      }

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text,
        },
      });
    }

    if (this.trace.steps.length > maxSteps) {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `_... and ${this.trace.steps.length - maxSteps} more steps_`,
          },
        ],
      });
    }

    return blocks;
  }

  /**
   * Format as Discord embed.
   */
  toDiscordEmbed(): {
    title: string;
    description: string;
    color: number;
    fields: Array<{ name: string; value: string; inline?: boolean }>;
    footer?: { text: string };
    timestamp?: string;
  } {
    const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

    fields.push({
      name: "Task ID",
      value: `\`${this.trace.taskId}\``,
      inline: true,
    });

    if (this.trace.agentRole) {
      fields.push({
        name: "Agent",
        value: this.trace.agentRole,
        inline: true,
      });
    }

    fields.push({
      name: "Success",
      value: this.trace.success ? "✅ Yes" : "❌ No",
      inline: true,
    });

    if (this.trace.completedAt) {
      const duration = this.trace.completedAt.getTime() - this.trace.startedAt.getTime();
      fields.push({
        name: "Duration",
        value: formatDuration(duration),
        inline: true,
      });
    }

    fields.push({
      name: "Total Steps",
      value: this.trace.totalSteps.toString(),
      inline: true,
    });

    const avgConfidence = this.calculateAverageConfidence();
    if (avgConfidence !== null) {
      fields.push({
        name: "Avg Confidence",
        value: `${(avgConfidence * 100).toFixed(0)}%`,
        inline: true,
      });
    }

    // Add first few steps
    const maxSteps = 5;
    const steps = this.trace.steps.slice(0, maxSteps);
    
    for (const step of steps) {
      const emoji = getStepEmoji(step.type);
      let value = step.content.slice(0, 200); // Discord field limit
      if (step.content.length > 200) {
        value += "...";
      }

      if (step.confidence !== undefined) {
        value += `\n_Confidence: ${(step.confidence * 100).toFixed(0)}%_`;
      }

      fields.push({
        name: `${emoji} ${step.type.toUpperCase()}`,
        value,
      });
    }

    if (this.trace.steps.length > maxSteps) {
      fields.push({
        name: "More steps...",
        value: `_${this.trace.steps.length - maxSteps} additional steps omitted_`,
      });
    }

    return {
      title: "🧠 Reasoning Trace",
      description: this.trace.finalDecision || "Task reasoning breakdown",
      color: this.trace.success ? 0x00ff00 : 0xff0000, // Green for success, red for failure
      fields,
      footer: {
        text: `Trace ID: ${this.trace.id}`,
      },
      timestamp: this.trace.startedAt.toISOString(),
    };
  }

  /**
   * Generate Mermaid diagram for decision tree visualization.
   */
  toMermaidDiagram(): string {
    const lines: string[] = [];
    
    lines.push("```mermaid");
    lines.push("graph TD");
    lines.push(`  Start[Task ${this.trace.taskId}]`);

    // Create nodes for each step
    for (let i = 0; i < this.trace.steps.length; i++) {
      const step = this.trace.steps[i];
      const nodeId = `S${i}`;
      const prevNodeId = i === 0 ? "Start" : `S${i - 1}`;
      
      const emoji = getStepEmoji(step.type);
      const label = `${emoji} ${step.type}: ${truncate(step.content, 30)}`;
      
      // Define node
      const nodeShape = getNodeShape(step.type);
      lines.push(`  ${nodeId}${nodeShape[0]}${label}${nodeShape[1]}`);
      
      // Connect to previous
      lines.push(`  ${prevNodeId} --> ${nodeId}`);

      // Add alternatives as branches
      if (step.alternatives && step.alternatives.length > 0) {
        for (let j = 0; j < step.alternatives.length; j++) {
          const altId = `A${i}_${j}`;
          const altLabel = `Alt: ${truncate(step.alternatives[j], 20)}`;
          lines.push(`  ${altId}[${altLabel}]`);
          lines.push(`  ${nodeId} -.-> ${altId}`);
          lines.push(`  style ${altId} fill:#f9f,stroke:#333,stroke-dasharray: 5 5`);
        }
      }

      // Style based on confidence
      if (step.confidence !== undefined) {
        const color = getConfidenceColor(step.confidence);
        lines.push(`  style ${nodeId} fill:${color}`);
      }
    }

    // End node
    const lastNodeId = this.trace.steps.length > 0 ? `S${this.trace.steps.length - 1}` : "Start";
    const endLabel = this.trace.success ? "✅ Success" : "❌ Failed";
    lines.push(`  End[${endLabel}]`);
    lines.push(`  ${lastNodeId} --> End`);
    lines.push(`  style End fill:${this.trace.success ? "#9f9" : "#f99"}`);

    lines.push("```");

    return lines.join("\n");
  }

  private calculateAverageConfidence(): number | null {
    const stepsWithConfidence = this.trace.steps.filter(s => s.confidence !== undefined);
    if (stepsWithConfidence.length === 0) return null;
    
    const sum = stepsWithConfidence.reduce((acc, s) => acc + (s.confidence || 0), 0);
    return sum / stepsWithConfidence.length;
  }
}

// Helper functions

function getStepEmoji(type: ReasoningStepType): string {
  switch (type) {
    case "thought": return "💭";
    case "action": return "⚡";
    case "observation": return "👁️";
    case "reflection": return "🔄";
    default: return "•";
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

function generateConfidenceBar(confidence: number): string {
  const filled = Math.round(confidence * 10);
  const empty = 10 - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

function getNodeShape(type: ReasoningStepType): [string, string] {
  switch (type) {
    case "thought": return ["(", ")"];     // Round
    case "action": return ["[", "]"];      // Rectangle
    case "observation": return ["{", "}"]; // Diamond
    case "reflection": return ["[[", "]]"]; // Subroutine
    default: return ["[", "]"];
  }
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return "#9f9"; // High confidence - green
  if (confidence >= 0.5) return "#ff9"; // Medium confidence - yellow
  return "#f99";                         // Low confidence - red
}
