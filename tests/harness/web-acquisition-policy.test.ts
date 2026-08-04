import { describe, expect, it } from "vitest";
import {
  calculateBackoffMs,
  createDefaultAntiBlockingPolicy,
  evaluateAcquisitionAttempt,
  validateWebAcquisitionMission,
  type AcquisitionAttempt,
  type WebAcquisitionMission,
} from "../../src/harness/web-acquisition/index";

const policy = createDefaultAntiBlockingPolicy();

function mission(overrides: Partial<WebAcquisitionMission> = {}): WebAcquisitionMission {
  return {
    schema: "tolani.natt.web-acquisition-mission.v1",
    missionId: "mission-001",
    tenantId: "tolani-corp",
    requestedBy: "devbot",
    purpose: "research",
    startUrls: ["https://example.com/docs"],
    allowedDomains: ["example.com"],
    deniedDomains: [],
    domainPolicies: [
      {
        domain: "example.com",
        allowed: true,
        respectRobotsTxt: true,
        termsReviewed: true,
        lawfulBasis: "Public documentation research",
        requestsPerMinute: 10,
        maxConcurrency: 2,
        minDelayMs: 1_000,
        allowedPaths: ["/docs"],
        deniedPaths: ["/account", "/admin"],
        approvedProviders: ["native-http", "crawlee", "firecrawl"],
      },
    ],
    dataClassification: "public",
    allowAuthenticatedContent: false,
    allowBrowserInteraction: true,
    publicationAllowed: false,
    humanApprovalRequired: false,
    outputFormats: ["markdown", "links"],
    cost: {
      maxCostUsd: 5,
      maxPages: 100,
      maxProviderCredits: 100,
      maxBrowserMinutes: 10,
      maxToolCalls: 200,
      maxRuntimeSeconds: 900,
      budgetAction: "stop",
    },
    createdAt: "2099-01-01T00:00:00.000Z",
    expiresAt: "2099-12-31T23:59:59.000Z",
    ...overrides,
  };
}

function attempt(overrides: Partial<AcquisitionAttempt> = {}): AcquisitionAttempt {
  return {
    url: "https://example.com/docs/start",
    provider: "native-http",
    attemptNumber: 1,
    priorFailuresForDomain: 0,
    requestsInLastMinute: 0,
    concurrentRequestsForDomain: 0,
    robotsDecision: "allowed",
    cacheHit: false,
    cacheFresh: false,
    blockSignal: "none",
    pagesConsumed: 0,
    providerCreditsConsumed: 0,
    browserMinutesConsumed: 0,
    toolCallsConsumed: 0,
    costUsdConsumed: 0,
    ...overrides,
  };
}

describe("NATT governed web acquisition", () => {
  it("validates a scoped mission", () => {
    expect(validateWebAcquisitionMission(mission())).toEqual([]);
  });

  it("requires approval for restricted or authenticated missions", () => {
    const errors = validateWebAcquisitionMission(
      mission({
        dataClassification: "restricted",
        allowAuthenticatedContent: true,
        humanApprovalRequired: false,
      }),
    );

    expect(errors.join(" ")).toContain("Restricted-data missions require human approval");
    expect(errors.join(" ")).toContain("Authenticated-content missions require human approval");
  });

  it("uses a fresh cache result before making a network request", () => {
    const decision = evaluateAcquisitionAttempt(
      mission(),
      policy,
      attempt({ cacheHit: true, cacheFresh: true }),
    );

    expect(decision.action).toBe("use-cache");
    expect(decision.auditTags).toContain("cost-control");
  });

  it("requires a robots preflight when policy is unknown", () => {
    const decision = evaluateAcquisitionAttempt(
      mission(),
      policy,
      attempt({ robotsDecision: "unknown" }),
    );

    expect(decision.action).toBe("request-approval");
    expect(decision.reasonCode).toBe("robots-preflight-required");
  });

  it("stops on access denial instead of changing providers", () => {
    const decision = evaluateAcquisitionAttempt(
      mission(),
      policy,
      attempt({ statusCode: 403, blockSignal: "access-denied" }),
    );

    expect(decision.action).toBe("stop");
    expect(decision.nextProvider).toBeUndefined();
    expect(decision.auditTags).toContain("no-circumvention");
  });

  it("stops when a CAPTCHA or challenge is detected", () => {
    const decision = evaluateAcquisitionAttempt(
      mission(),
      policy,
      attempt({ blockSignal: "captcha-or-challenge" }),
    );

    expect(decision.action).toBe("stop");
    expect(decision.reason).toContain("bypass is prohibited");
  });

  it("honors rate limiting and Retry-After", () => {
    const decision = evaluateAcquisitionAttempt(
      mission(),
      policy,
      attempt({ statusCode: 429, retryAfterSeconds: 90, blockSignal: "rate-limited" }),
    );

    expect(decision.action).toBe("delay");
    expect(decision.delayMs).toBeGreaterThanOrEqual(90_000);
  });

  it("uses an approved provider fallback only for transient technical failures", () => {
    const decision = evaluateAcquisitionAttempt(
      mission(),
      policy,
      attempt({ blockSignal: "rendering-failure" }),
    );

    expect(decision.action).toBe("fallback-provider");
    expect(decision.nextProvider).toBe("crawlee");
  });

  it("opens the circuit after repeated domain failures", () => {
    const decision = evaluateAcquisitionAttempt(
      mission(),
      policy,
      attempt({ priorFailuresForDomain: policy.circuitBreaker.failureThreshold }),
    );

    expect(decision.action).toBe("stop");
    expect(decision.reasonCode).toBe("domain-circuit-open");
  });

  it("blocks requests that exceed the cost envelope", () => {
    const decision = evaluateAcquisitionAttempt(
      mission(),
      policy,
      attempt({ costUsdConsumed: 5 }),
    );

    expect(decision.action).toBe("stop");
    expect(decision.reasonCode).toBe("budget-exhausted");
  });

  it("keeps exponential backoff bounded", () => {
    const first = calculateBackoffMs(1, policy);
    const late = calculateBackoffMs(20, policy);

    expect(first).toBeGreaterThan(0);
    expect(late).toBeLessThanOrEqual(
      Math.ceil(policy.retry.maxDelayMs * (1 + policy.retry.jitterRatio)),
    );
  });
});
