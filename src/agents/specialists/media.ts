import Anthropic from "@anthropic-ai/sdk";
import { mediaPlatform } from "@/mcp/client.js";
import type { AgentTask, AgentResult } from "../types.js";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";

export async function executeMediaTask(task: AgentTask): Promise<AgentResult> {
  console.log(`[media-agent] Executing task: ${task.description}`);

  try {
    // Ensure MCP client is connected
    await mediaPlatform.connect();

    const systemPrompt = `You are a specialized media processing agent.
Your job is to execute media-related tasks using the available MCP tools and resources.
You can read MIT Video Productions guidelines to ensure accuracy and optimization.
Available resources:
- file:///platform_directory/mit_guidelines/remote_capture_guidelines.md
- file:///platform_directory/mit_guidelines/lower_thirds_specifications.md
- file:///platform_directory/mit_guidelines/captions_tip_sheet.md
- file:///platform_directory/mit_guidelines/webcast_promotion_tips.md

When you are done, respond with a final JSON object matching this schema:
{
  "success": true | false,
  "output": "Summary of what was done",
  "changes": [],
  "error": "Error message if success is false, otherwise omit"
}`;

    let messages: Anthropic.MessageParam[] = [{ role: "user", content: `Task: ${task.description}` }];
    let finalResult: AgentResult | null = null;

    // Simple loop to handle tool calls
    for (let i = 0; i < 5; i++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages,
        tools: [
          {
            name: "read_resource",
            description: "Read a resource from the MCP server (e.g., MIT guidelines)",
            input_schema: {
              type: "object",
              properties: {
                uri: { type: "string", description: "The URI of the resource to read" }
              },
              required: ["uri"]
            }
          },
          {
            name: "create_video_preview",
            description: "Extracts short clips from a source video and concatenates them into a preview.",
            input_schema: {
              type: "object",
              properties: {
                inputPath: { type: "string" },
                outputPath: { type: "string" },
                clipDuration: { type: "number" },
                moneyShotTime: { type: "number" }
              },
              required: ["inputPath", "outputPath"]
            }
          },
          {
            name: "finish_task",
            description: "Call this when the task is complete to return the final result.",
            input_schema: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                output: { type: "string" },
                error: { type: "string" }
              },
              required: ["success", "output"]
            }
          }
        ]
      });

      messages.push({ role: "assistant", content: response.content });

      const toolCalls = response.content.filter(c => c.type === "tool_use") as Anthropic.ToolUseBlock[];
      
      if (toolCalls.length === 0) {
        // If no tool calls, try to parse the text as JSON
        const text = response.content.find(c => c.type === "text") as Anthropic.TextBlock;
        if (text) {
          const jsonMatch = text.text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            finalResult = JSON.parse(jsonMatch[0]);
            break;
          }
        }
        throw new Error("Agent did not call finish_task or return valid JSON.");
      }

      let toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolCall of toolCalls) {
        if (toolCall.name === "finish_task") {
          const args = toolCall.input as any;
          finalResult = {
            success: args.success,
            output: args.output,
            changes: [],
            error: args.error
          };
          break;
        } else if (toolCall.name === "read_resource") {
          const args = toolCall.input as any;
          console.log(`[media-agent] Reading resource: ${args.uri}`);
          try {
            const res = await mediaPlatform.readResource(args.uri);
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolCall.id,
              content: JSON.stringify(res)
            });
          } catch (e: any) {
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolCall.id,
              content: `Error: ${e.message}`,
              is_error: true
            });
          }
        } else if (toolCall.name === "create_video_preview") {
          const args = toolCall.input as any;
          console.log(`[media-agent] Calling create_video_preview:`, args);
          try {
            const res = await mediaPlatform.createVideoPreview(
              args.inputPath,
              args.outputPath,
              args.clipDuration,
              args.moneyShotTime
            );
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolCall.id,
              content: JSON.stringify(res)
            });
          } catch (e: any) {
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolCall.id,
              content: `Error: ${e.message}`,
              is_error: true
            });
          }
        }
      }

      if (finalResult) break;

      messages.push({ role: "user", content: toolResults });
    }

    if (!finalResult) {
      throw new Error("Agent exceeded maximum iterations without finishing.");
    }

    return finalResult;
  } catch (err) {
    console.error(`[media-agent] Error:`, err);
    return {
      success: false,
      output: "",
      error: `Media agent failed: ${(err as Error).message}`,
    };
  }
}
