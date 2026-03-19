import { access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

type AgentModule = {
  createFeatureBlueprint: (
    featureRequest: string,
    context?: {
      repository?: string;
      userId?: string;
      workspaceId?: string;
      preferredModel?: string;
    },
  ) => Promise<unknown>;
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
  const featureRequest = String(args?.feature_request ?? "").trim();

  if (!featureRequest) {
    return {
      content: [{ type: "text", text: "Missing required argument: feature_request" }],
      isError: true,
    };
  }

  const agent = await loadAgent();
  const blueprint = await agent.createFeatureBlueprint(featureRequest, {
    repository: args?.repository,
    userId: args?.userId,
    workspaceId: args?.workspaceId,
    preferredModel: args?.preferredModel,
  });

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(blueprint, null, 2),
      },
    ],
  };
}
