import { describe, expect, it } from "vitest";

import { buildUxResponse } from "../../mcp-natt/src/ux-response.js";

describe("mcp-natt UX response envelope", () => {
  it("wraps plain text tool output in a consistent envelope", () => {
    const result = buildUxResponse({
      toolName: "get_jwt_attack",
      startedAt: Date.now() - 10,
      result: {
        content: [{ type: "text", text: "JWT attack analysis complete." }],
      },
      cached: false,
      truncated: false,
    });

    expect(result.isError).toBe(false);
    expect(result.content).toHaveLength(1);

    const text = (result.content[0] as { type: string; text: string }).text;
    const payload = JSON.parse(text) as Record<string, any>;

    expect(payload.status).toBe("success");
    expect(payload).toHaveProperty("summary");
    expect(payload).toHaveProperty("highlights");
    expect(payload).toHaveProperty("data");
    expect(payload).toHaveProperty("actions");
    expect(payload).toHaveProperty("confidence");
    expect(payload).toHaveProperty("meta");
    expect(payload.meta.toolName).toBe("get_jwt_attack");
    expect(payload.meta.cached).toBe(false);
    expect(payload.meta.truncated).toBe(false);
  });

  it("preserves a pre-structured envelope and refreshes runtime metadata", () => {
    const preStructured = {
      status: "success",
      summary: "Existing envelope",
      highlights: ["h1"],
      data: { payload: { ok: true } },
      actions: [{ label: "l", command: "c", impact: "i" }],
      confidence: { level: "high", rationale: "already validated" },
      meta: {
        toolName: "old",
        durationMs: 1,
        timestamp: "2020-01-01T00:00:00.000Z",
        requestId: "req-1",
        cached: false,
        truncated: false,
      },
    };

    const result = buildUxResponse({
      toolName: "scan_for_secrets",
      startedAt: Date.now() - 5,
      result: {
        content: [{ type: "text", text: JSON.stringify(preStructured) }],
      },
      cached: true,
      truncated: true,
    });

    const text = (result.content[0] as { type: string; text: string }).text;
    const payload = JSON.parse(text) as Record<string, any>;

    expect(payload.summary).toBe("Existing envelope");
    expect(payload.meta.toolName).toBe("scan_for_secrets");
    expect(payload.meta.cached).toBe(true);
    expect(payload.meta.truncated).toBe(true);
    expect(payload.meta.requestId).toBe("req-1");
  });

  it("marks error responses with status=error and isError=true", () => {
    const result = buildUxResponse({
      toolName: "unknown_tool",
      startedAt: Date.now() - 3,
      result: {
        content: [{ type: "text", text: "Unknown tool: unknown_tool" }],
        isError: true,
      },
      cached: false,
      truncated: false,
    });

    expect(result.isError).toBe(true);

    const text = (result.content[0] as { type: string; text: string }).text;
    const payload = JSON.parse(text) as Record<string, any>;

    expect(payload.status).toBe("error");
    expect(payload.actions.length).toBeGreaterThan(0);
    expect(payload.confidence.level).toBe("low");
  });
});
