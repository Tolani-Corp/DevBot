import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { handleApiRequest } from "@/services/http-api";

const ORIGINAL_ENV = { ...process.env };

function createRequest(input: {
  method?: string;
  url?: string;
  headers?: IncomingHttpHeaders;
}): IncomingMessage {
  return {
    method: input.method ?? "GET",
    url: input.url ?? "/api/unknown",
    headers: input.headers ?? {},
  } as IncomingMessage;
}

function createResponse(): ServerResponse & { body: string; statusCode: number } {
  return {
    body: "",
    statusCode: 0,
    writeHead(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    end(chunk?: unknown) {
      this.body = chunk === undefined ? "" : String(chunk);
      return this;
    },
  } as ServerResponse & { body: string; statusCode: number };
}

describe("http-api auth", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, NODE_ENV: "test" };
    delete process.env.API_AUTH_TOKEN;
    delete process.env.DEVBOT_ALLOW_UNAUTHENTICATED_API;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("fails closed when API_AUTH_TOKEN is not configured", async () => {
    const res = createResponse();

    await handleApiRequest(createRequest({ url: "/api/tasks" }), res);

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toEqual({ error: "api_auth_not_configured" });
  });

  it("rejects missing and invalid tokens when API_AUTH_TOKEN is configured", async () => {
    process.env.API_AUTH_TOKEN = "expected-token";
    const missingTokenResponse = createResponse();
    const invalidTokenResponse = createResponse();

    await handleApiRequest(createRequest({ url: "/api/tasks" }), missingTokenResponse);
    await handleApiRequest(
      createRequest({ url: "/api/tasks", headers: { authorization: "Bearer wrong-token" } }),
      invalidTokenResponse,
    );

    expect(missingTokenResponse.statusCode).toBe(403);
    expect(JSON.parse(missingTokenResponse.body)).toEqual({ error: "invalid_api_token" });
    expect(invalidTokenResponse.statusCode).toBe(403);
    expect(JSON.parse(invalidTokenResponse.body)).toEqual({ error: "invalid_api_token" });
  });

  it("accepts bearer and x-api-key credentials", async () => {
    process.env.API_AUTH_TOKEN = "expected-token";
    const bearerResponse = createResponse();
    const apiKeyResponse = createResponse();

    await handleApiRequest(
      createRequest({ url: "/api/unknown", headers: { authorization: "Bearer expected-token" } }),
      bearerResponse,
    );
    await handleApiRequest(
      createRequest({ url: "/api/unknown", headers: { "x-api-key": "expected-token" } }),
      apiKeyResponse,
    );

    expect(bearerResponse.statusCode).toBe(404);
    expect(apiKeyResponse.statusCode).toBe(404);
  });

  it("allows explicit unauthenticated mode only outside production", async () => {
    process.env.DEVBOT_ALLOW_UNAUTHENTICATED_API = "true";
    const devResponse = createResponse();
    await handleApiRequest(createRequest({ url: "/api/unknown" }), devResponse);

    process.env.NODE_ENV = "production";
    const productionResponse = createResponse();
    await handleApiRequest(createRequest({ url: "/api/unknown" }), productionResponse);

    expect(devResponse.statusCode).toBe(404);
    expect(productionResponse.statusCode).toBe(403);
    expect(JSON.parse(productionResponse.body)).toEqual({ error: "api_auth_not_configured" });
  });
});
