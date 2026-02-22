#!/usr/bin/env node
/**
 * CLI script to display reasoning traces for a task.
 * Usage: npm run show-reasoning <taskId>
 */

import { getReasoningTracesForTask } from "../services/reasoning-trace.js";
import { TraceVisualizer } from "../reasoning/visualizer.js";
import { formatTraceForDisplay, mergeTraces } from "../reasoning/trace.js";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: npm run show-reasoning <taskId> [--format=text|markdown|mermaid|json]");
    console.error("");
    console.error("Options:");
    console.error("  --format=text       Plain text output (default)");
    console.error("  --format=markdown   Markdown with collapsible sections");
    console.error("  --format=mermaid    Mermaid diagram");
    console.error("  --format=json       Raw JSON export");
    process.exit(1);
  }

  const taskId = args[0];
  const formatArg = args.find(arg => arg.startsWith("--format="));
  const format = formatArg ? formatArg.split("=")[1] : "text";

  console.log(`\n🔍 Fetching reasoning traces for task: ${taskId}\n`);

  try {
    const traces = await getReasoningTracesForTask(taskId);

    if (traces.length === 0) {
      console.log(`❌ No reasoning traces found for task: ${taskId}`);
      console.log(`\nMake sure the task has been executed with trace capture enabled.`);
      process.exit(1);
    }

    console.log(`✅ Found ${traces.length} trace(s)\n`);
    console.log("=".repeat(80));
    console.log("");

    if (traces.length === 1) {
      // Single trace
      const trace = traces[0];
      const visualizer = new TraceVisualizer(trace);

      switch (format) {
        case "markdown":
          console.log(visualizer.toMarkdown());
          break;
        case "mermaid":
          console.log(visualizer.toMermaidDiagram());
          break;
        case "json":
          console.log(JSON.stringify(trace, null, 2));
          break;
        case "text":
        default:
          console.log(formatTraceForDisplay(trace));
          break;
      }
    } else {
      // Multiple traces - merge them into timeline
      console.log(`📊 Multiple traces detected - merging into unified timeline\n`);
      const merged = mergeTraces(traces);
      const visualizer = new TraceVisualizer(merged);

      switch (format) {
        case "markdown":
          console.log(visualizer.toMarkdown());
          break;
        case "mermaid":
          console.log(visualizer.toMermaidDiagram());
          break;
        case "json":
          console.log(JSON.stringify(merged, null, 2));
          break;
        case "text":
        default:
          console.log(formatTraceForDisplay(merged));
          break;
      }

      console.log("\n");
      console.log("=".repeat(80));
      console.log("\n📋 Individual Traces:\n");

      for (let i = 0; i < traces.length; i++) {
        console.log(`\n## Trace ${i + 1}: ${traces[i].agentRole || "unknown"} (${traces[i].id})\n`);
        console.log(formatTraceForDisplay(traces[i]));
      }
    }

    console.log("");
    console.log("=".repeat(80));
    console.log("");

  } catch (error) {
    console.error(`\n❌ Error fetching traces: ${(error as Error).message}`);
    console.error((error as Error).stack);
    process.exit(1);
  }
}

main();
