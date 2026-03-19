import { access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

type AgentModule = {
  generatePlatformStrategy: (
    objective: string,
    context?: {
      repository?: string;
      userId?: string;
      workspaceId?: string;
      preferredModel?: string;
    },
  ) => Promise<string>;
};

async function loadAgent(): Promise<AgentModule> {
  const candidates = [
    path.resolve(process.cwd(), "dist/ai/bettorsace-agent.js"),
    path.resolve(process.cwd(), "../dist/ai/bettorsace-agent.js"),
    path.resolve(process.cwd(), "src/ai/bettorsace-agent.ts"),
    path.resolve(process.cwd(), "src/ai/bettorsace-agent.js"),
    path.resolve(process.cwd(), "../src/ai/bettorsace-agent.ts"),
    path.resolve(process.cwd(), "../src/ai/bettorsace-agent.js"),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return (await import(pathToFileURL(candidate).href)) as AgentModule;
    } catch {
      // Try next candidate
    }
  }

  throw new Error("Unable to locate BettorsACE agent module from MCP server.");
}

export async function handle(args: any) {
  const objective = String(args?.objective ?? "").trim();

  if (!objective) {
    return {
      content: [{ type: "text", text: "Missing required argument: objective" }],
      isError: true,
    };
  }

  const agent = await loadAgent();
  const strategy = await agent.generatePlatformStrategy(objective, {
    repository: args?.repository,
    userId: args?.userId,
    workspaceId: args?.workspaceId,
    preferredModel: args?.preferredModel,
  });

  return {
    content: [
      {
        type: "text",
        text: strategy,
      },
    ],
  };
}
