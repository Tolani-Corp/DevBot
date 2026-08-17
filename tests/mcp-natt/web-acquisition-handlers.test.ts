import { describe, expect, it } from "vitest";
import { handle as decideAccessResponse } from "../../mcp-natt/src/handlers/decide_access_response";
import { handle as getProhibitions } from "../../mcp-natt/src/handlers/get_web_acquisition_prohibitions";
import { handle as selectProvider } from "../../mcp-natt/src/handlers/select_acquisition_provider";
import { handle as validateMission } from "../../mcp-natt/src/handlers/validate_web_acquisition_mission";
import {
  DEFAULT_ACCESS_RESILIENCE_POLICY,
  type WebAcquisitionMission,
} from "../../mcp-natt/src/web-acquisition-policy";

function parseText(result: { content: Array<{ type: string; text?: string }> }) {
  const text = result.content.find((item) => item.type === "text")?.text;
  if (!text) throw new Error("Expected text content");
  return JSON.parse(text) as Record<string, unknown>;
}

function mission(): WebAcquisitionMission {
  return {
    missionId: "mission-handler-001",
    tenantId: "tolani-labs",
    requestedBy: "dataset-agent",
    purpose: "dataset-development",
    startUrls: ["https://example.gov/data"],
    allowedDomains: ["example.gov"],
    deniedDomains: [],
    dataClassification: "public",
    publicationAllowed: false,
    humanApprovalRequired: true,
    allowAuthenticatedPages: false,
    providerPreference: ["native-http", "crawlee", "firecrawl"],
    budget: {
      maxPages: 100,
      maxDepth: 2,
      maxRequests: 150,
      maxRuntimeSeconds: 900,
      maxProviderCredits: 100,
      maxEstimatedCostUsd: 5,
      budgetAction: "request-approval",
    },
    resilience: { ...DEFAULT_ACCESS_RESILIENCE_POLICY },
  };
}

describe("web acquisition MCP handlers", () => {
  it("returns an approved validation result for a compliant mission", async () => {
    const result = await validateMission({ mission: mission() });
    const payload = parseText(result);

    expect(payload.approved).toBe(true);
    expect(result.isError).toBe(false);
  });

  it("fails closed when a mission payload is missing", async () => {
    const result = await validateMission({});
    const payload = parseText(result);

    expect(payload.approved).toBe(false);
    expect(result.isError).toBe(true);
  });

  it("selects native HTTP for an approved static source", async () => {
    const result = await selectProvider({
      knownStaticSource: true,
      providerPreference: ["native-http", "crawlee", "firecrawl"],
      providerAvailability: {
        "native-http": true,
        crawlee: true,
        firecrawl: true,
      },
    });
    const payload = parseText(result);

    expect(payload.provider).toBe("native-http");
  });

  it("stops automation and requests review on CAPTCHA detection", async () => {
    const result = await decideAccessResponse({
      signal: { detectedCaptcha: true, statusCode: 403 },
      attempt: 0,
      consecutiveFailures: 0,
      policy: DEFAULT_ACCESS_RESILIENCE_POLICY,
    });
    const payload = parseText(result);

    expect(payload.decision).toBe("manual-review");
    expect(result.isError).toBe(true);
  });

  it("publishes the explicit access-evasion prohibition registry", async () => {
    const result = await getProhibitions();
    const payload = parseText(result);
    const techniques = payload.prohibitedTechniques as string[];

    expect(techniques).toContain("captcha-solving-or-bypass");
    expect(techniques).toContain("browser-fingerprint-spoofing");
    expect(techniques).toContain("impersonation-of-a-real-person");
  });
});
