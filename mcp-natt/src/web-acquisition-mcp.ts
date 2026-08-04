#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "natt-web-acquisition-policy",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "validate_web_acquisition_mission",
      description:
        "Validate a domain-scoped, budgeted web acquisition mission before any provider call.",
      inputSchema: {
        type: "object",
        properties: {
          mission: {
            type: "object",
            description: "Complete WebAcquisitionMission payload.",
          },
        },
        required: ["mission"],
      },
    },
    {
      name: "decide_access_response",
      description:
        "Decide whether to accept, retry with bounded backoff, open a circuit, stop, or require manual review.",
      inputSchema: {
        type: "object",
        properties: {
          signal: { type: "object" },
          attempt: { type: "number", minimum: 0 },
          consecutiveFailures: { type: "number", minimum: 0 },
          policy: { type: "object" },
        },
        required: ["signal", "policy"],
      },
    },
    {
      name: "select_acquisition_provider",
      description:
        "Select the lowest-cost approved provider that satisfies static, JavaScript, or stateful-browser requirements.",
      inputSchema: {
        type: "object",
        properties: {
          requiresJavascript: { type: "boolean" },
          requiresStatefulBrowser: { type: "boolean" },
          knownStaticSource: { type: "boolean" },
          providerPreference: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "native-http",
                "crawlee",
                "firecrawl",
                "browserless",
                "manual-review",
              ],
            },
          },
          providerAvailability: {
            type: "object",
            additionalProperties: { type: "boolean" },
          },
        },
        required: [],
      },
    },
    {
      name: "get_web_acquisition_prohibitions",
      description:
        "Return prohibited access-evasion techniques, mandatory stop conditions, and the default resilience policy.",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const handler = await import(`./handlers/${name}.js`);
    return await handler.handle(args);
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: "WEB_ACQUISITION_TOOL_ERROR",
              tool: name,
              message: error instanceof Error ? error.message : String(error),
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[NATT MCP] Web acquisition policy server running");
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
