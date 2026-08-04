import { describe, expect, it } from "vitest";
import {
  DEFAULT_ACCESS_RESILIENCE_POLICY,
  PROHIBITED_ACCESS_TECHNIQUES,
  computeBackoffDelayMs,
  decideAccessResponse,
  selectAcquisitionProvider,
  validateWebAcquisitionMission,
  type WebAcquisitionMission,
} from "../../mcp-natt/src/web-acquisition-policy";

function buildMission(
  overrides: Partial<WebAcquisitionMission> = {},
): WebAcquisitionMission {
  return {
    missionId: "mission-001",
    tenantId: "tolani-labs",
    requestedBy: "research-agent",
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
    ...overrides,
  };
}

describe("web acquisition policy", () => {
  it("approves a transparent, allowlisted, budgeted mission", () => {
    const result = validateWebAcquisitionMission(buildMission());

    expect(result.approved).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.normalizedDomains).toEqual(["example.gov"]);
    expect(result.requiredApprovals).toContain("mission-owner");
  });

  it("blocks URLs outside the mission allowlist", () => {
    const result = validateWebAcquisitionMission(
      buildMission({ startUrls: ["https://unapproved.example/data"] }),
    );

    expect(result.approved).toBe(false);
    expect(
      result.violations.some(
        (violation) => violation.code === "DOMAIN_NOT_ALLOWLISTED",
      ),
    ).toBe(true);
  });

  it("requires stop controls for CAPTCHA, authentication, and explicit blocks", () => {
    const result = validateWebAcquisitionMission(
      buildMission({
        resilience: {
          ...DEFAULT_ACCESS_RESILIENCE_POLICY,
          stopOnCaptcha: false as true,
        },
      }),
    );

    expect(result.approved).toBe(false);
    expect(
      result.violations.some(
        (violation) => violation.code === "STOP_CONTROLS_REQUIRED",
      ),
    ).toBe(true);
  });

  it("stops and escalates when a CAPTCHA is detected", () => {
    const decision = decideAccessResponse(
      { detectedCaptcha: true, statusCode: 403 },
      0,
      0,
      DEFAULT_ACCESS_RESILIENCE_POLICY,
    );

    expect(decision.decision).toBe("manual-review");
  });

  it("uses bounded backoff for transient failures", () => {
    const delay = computeBackoffDelayMs(
      3,
      DEFAULT_ACCESS_RESILIENCE_POLICY,
    );

    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThanOrEqual(
      DEFAULT_ACCESS_RESILIENCE_POLICY.maxBackoffMs,
    );
  });

  it("opens a circuit after repeated failures", () => {
    const decision = decideAccessResponse(
      { networkError: true },
      1,
      DEFAULT_ACCESS_RESILIENCE_POLICY.circuitBreakerFailureThreshold,
      DEFAULT_ACCESS_RESILIENCE_POLICY,
    );

    expect(decision.decision).toBe("open-circuit");
    expect(decision.retryAfterMs).toBe(
      DEFAULT_ACCESS_RESILIENCE_POLICY.circuitBreakerCooldownMs,
    );
  });

  it("routes static public pages to the lowest-cost available provider", () => {
    const provider = selectAcquisitionProvider({
      requiresJavascript: false,
      requiresStatefulBrowser: false,
      knownStaticSource: true,
      providerPreference: ["native-http", "crawlee", "firecrawl"],
      providerAvailability: {
        "native-http": true,
        crawlee: true,
        firecrawl: true,
      },
    });

    expect(provider).toBe("native-http");
  });

  it("documents prohibited access-evasion techniques", () => {
    expect(PROHIBITED_ACCESS_TECHNIQUES).toContain(
      "captcha-solving-or-bypass",
    );
    expect(PROHIBITED_ACCESS_TECHNIQUES).toContain(
      "impersonation-of-a-real-person",
    );
    expect(PROHIBITED_ACCESS_TECHNIQUES).toContain(
      "proxy-rotation-to-evade-an-explicit-block",
    );
  });
});
