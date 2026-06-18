import { config } from "./config.js";

export type DevBotTaskResponse = {
  taskId?: string;
  id?: string;
  status?: string;
  repository?: string | null;
  [key: string]: unknown;
};

export type DevBotHealth = {
  status: "ok" | "degraded" | "unavailable";
  apiBaseUrl: string;
  detail: string;
  timestamp: string;
};

export class DevBotClient {
  async getStatus(): Promise<DevBotHealth> {
    const endpoint = `${config.devbotApiBaseUrl}/health`;
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return {
          status: "degraded",
          apiBaseUrl: config.devbotApiBaseUrl,
          detail: `Health endpoint returned ${response.status}.`,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        status: "ok",
        apiBaseUrl: config.devbotApiBaseUrl,
        detail: "DevBot runtime health endpoint is reachable.",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "unavailable",
        apiBaseUrl: config.devbotApiBaseUrl,
        detail:
          error instanceof Error
            ? error.message
            : "DevBot runtime health check failed.",
        timestamp: new Date().toISOString(),
      };
    }
  }

  async createTask(input: {
    description: string;
    repository?: string;
  }): Promise<DevBotTaskResponse> {
    if (!config.devbotApiToken) {
      throw new Error("DEVBOT_API_TOKEN is required before Teams can create tasks.");
    }

    const response = await fetch(`${config.devbotApiBaseUrl}/api/tasks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.devbotApiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        description: input.description,
        repository:
          input.repository ??
          config.devbotDefaultRepository ??
          undefined,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const rawBody = await response.text();
    let parsedBody: unknown;
    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      parsedBody = { rawBody };
    }

    if (!response.ok) {
      const message =
        typeof parsedBody === "object" &&
        parsedBody !== null &&
        "error" in parsedBody
          ? String((parsedBody as { error: unknown }).error)
          : `DevBot API returned ${response.status}.`;
      throw new Error(message);
    }

    return parsedBody as DevBotTaskResponse;
  }
}

export const devbotClient = new DevBotClient();
