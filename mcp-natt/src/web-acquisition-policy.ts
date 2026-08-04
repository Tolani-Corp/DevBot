export type WebAcquisitionPurpose =
  | "research"
  | "supplier-validation"
  | "regulatory-monitoring"
  | "competitive-intelligence"
  | "dataset-development"
  | "security-testing-authorized";

export type DataClassification =
  | "public"
  | "internal"
  | "confidential"
  | "restricted";

export type AcquisitionProvider =
  | "native-http"
  | "crawlee"
  | "firecrawl"
  | "browserless"
  | "manual-review";

export type BudgetAction =
  | "stop"
  | "request-approval"
  | "return-partial-result"
  | "downgrade-provider";

export interface AcquisitionBudget {
  maxPages: number;
  maxDepth: number;
  maxRequests: number;
  maxRuntimeSeconds: number;
  maxProviderCredits: number;
  maxEstimatedCostUsd: number;
  budgetAction: BudgetAction;
}

export interface AccessResiliencePolicy {
  respectRobotsTxt: true;
  identifyAutomation: true;
  userAgent: string;
  contactUrl?: string;
  requestsPerMinute: number;
  maxConcurrentRequests: number;
  minimumDelayMs: number;
  jitterMs: number;
  retryableStatusCodes: number[];
  maxRetries: number;
  backoffBaseMs: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
  circuitBreakerFailureThreshold: number;
  circuitBreakerCooldownMs: number;
  cacheTtlSeconds: number;
  stopOnCaptcha: true;
  stopOnAuthenticationChallenge: true;
  stopOnExplicitBlock: true;
}

export interface WebAcquisitionMission {
  missionId: string;
  tenantId: string;
  requestedBy: string;
  purpose: WebAcquisitionPurpose;
  startUrls: string[];
  allowedDomains: string[];
  deniedDomains: string[];
  dataClassification: DataClassification;
  publicationAllowed: boolean;
  humanApprovalRequired: boolean;
  allowAuthenticatedPages: boolean;
  providerPreference: AcquisitionProvider[];
  budget: AcquisitionBudget;
  resilience: AccessResiliencePolicy;
}

export interface PolicyViolation {
  code: string;
  severity: "warning" | "blocking";
  message: string;
  field?: string;
}

export interface MissionValidationResult {
  approved: boolean;
  violations: PolicyViolation[];
  normalizedDomains: string[];
  requiredApprovals: string[];
}

export interface AccessResponseSignal {
  statusCode?: number;
  responseHeaders?: Record<string, string | undefined>;
  bodyText?: string;
  detectedCaptcha?: boolean;
  detectedAuthenticationChallenge?: boolean;
  detectedExplicitBlock?: boolean;
  networkError?: boolean;
}

export type AccessDecision =
  | "accept"
  | "retry-with-backoff"
  | "open-circuit"
  | "manual-review"
  | "stop";

export interface AccessDecisionResult {
  decision: AccessDecision;
  reason: string;
  retryAfterMs?: number;
}

export const PROHIBITED_ACCESS_TECHNIQUES = [
  "captcha-solving-or-bypass",
  "browser-fingerprint-spoofing",
  "device-identity-spoofing",
  "credential-replay",
  "session-token-theft-or-reuse",
  "impersonation-of-a-real-person",
  "misrepresentation-of-automation-as-human",
  "circumvention-of-paywalls-or-access-controls",
  "proxy-rotation-to-evade-an-explicit-block",
  "continued-access-after-a-cease-or-deny-signal",
] as const;

export const DEFAULT_ACCESS_RESILIENCE_POLICY: AccessResiliencePolicy = {
  respectRobotsTxt: true,
  identifyAutomation: true,
  userAgent: "TolaniResearchBot/1.0 (+https://tolanicorp.us/automation-policy)",
  requestsPerMinute: 30,
  maxConcurrentRequests: 2,
  minimumDelayMs: 1_000,
  jitterMs: 250,
  retryableStatusCodes: [408, 425, 429, 500, 502, 503, 504],
  maxRetries: 3,
  backoffBaseMs: 1_000,
  backoffMultiplier: 2,
  maxBackoffMs: 30_000,
  circuitBreakerFailureThreshold: 5,
  circuitBreakerCooldownMs: 15 * 60 * 1_000,
  cacheTtlSeconds: 24 * 60 * 60,
  stopOnCaptcha: true,
  stopOnAuthenticationChallenge: true,
  stopOnExplicitBlock: true,
};

const DOMAIN_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

function normalizeDomain(value: string): string {
  const trimmed = value.trim().toLowerCase();
  try {
    const url = trimmed.includes("://")
      ? new URL(trimmed)
      : new URL(`https://${trimmed}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return trimmed.replace(/^www\./, "");
  }
}

function domainAllowed(hostname: string, allowedDomains: string[]): boolean {
  return allowedDomains.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
}

function domainDenied(hostname: string, deniedDomains: string[]): boolean {
  return deniedDomains.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
}

export function validateWebAcquisitionMission(
  mission: WebAcquisitionMission,
): MissionValidationResult {
  const violations: PolicyViolation[] = [];
  const requiredApprovals = new Set<string>();
  const allowedDomains = [...new Set(mission.allowedDomains.map(normalizeDomain))];
  const deniedDomains = [...new Set(mission.deniedDomains.map(normalizeDomain))];

  if (!mission.missionId.trim()) {
    violations.push({
      code: "MISSION_ID_REQUIRED",
      severity: "blocking",
      message: "A mission ID is required for audit correlation.",
      field: "missionId",
    });
  }

  if (mission.startUrls.length === 0) {
    violations.push({
      code: "START_URL_REQUIRED",
      severity: "blocking",
      message: "At least one start URL is required.",
      field: "startUrls",
    });
  }

  for (const domain of allowedDomains) {
    if (!DOMAIN_PATTERN.test(domain)) {
      violations.push({
        code: "INVALID_ALLOWED_DOMAIN",
        severity: "blocking",
        message: `Invalid allowed domain: ${domain}`,
        field: "allowedDomains",
      });
    }
  }

  for (const rawUrl of mission.startUrls) {
    try {
      const url = new URL(rawUrl);
      const hostname = normalizeDomain(url.hostname);

      if (url.protocol !== "https:" && url.protocol !== "http:") {
        violations.push({
          code: "UNSUPPORTED_PROTOCOL",
          severity: "blocking",
          message: `Only HTTP and HTTPS URLs are permitted: ${rawUrl}`,
          field: "startUrls",
        });
      }

      if (!domainAllowed(hostname, allowedDomains)) {
        violations.push({
          code: "DOMAIN_NOT_ALLOWLISTED",
          severity: "blocking",
          message: `Start URL domain is not allowlisted: ${hostname}`,
          field: "startUrls",
        });
      }

      if (domainDenied(hostname, deniedDomains)) {
        violations.push({
          code: "DOMAIN_EXPLICITLY_DENIED",
          severity: "blocking",
          message: `Start URL domain is explicitly denied: ${hostname}`,
          field: "startUrls",
        });
      }
    } catch {
      violations.push({
        code: "INVALID_START_URL",
        severity: "blocking",
        message: `Invalid start URL: ${rawUrl}`,
        field: "startUrls",
      });
    }
  }

  if (mission.resilience.respectRobotsTxt !== true) {
    violations.push({
      code: "ROBOTS_REQUIRED",
      severity: "blocking",
      message: "robots.txt compliance must remain enabled.",
      field: "resilience.respectRobotsTxt",
    });
  }

  if (mission.resilience.identifyAutomation !== true) {
    violations.push({
      code: "AUTOMATION_IDENTIFICATION_REQUIRED",
      severity: "blocking",
      message: "The client must identify itself as authorized automation.",
      field: "resilience.identifyAutomation",
    });
  }

  if (
    mission.resilience.stopOnCaptcha !== true ||
    mission.resilience.stopOnAuthenticationChallenge !== true ||
    mission.resilience.stopOnExplicitBlock !== true
  ) {
    violations.push({
      code: "STOP_CONTROLS_REQUIRED",
      severity: "blocking",
      message:
        "CAPTCHA, authentication challenges, and explicit block signals must stop automated execution.",
      field: "resilience",
    });
  }

  if (mission.resilience.requestsPerMinute < 1) {
    violations.push({
      code: "INVALID_RATE_LIMIT",
      severity: "blocking",
      message: "requestsPerMinute must be at least 1.",
      field: "resilience.requestsPerMinute",
    });
  }

  if (mission.resilience.maxConcurrentRequests < 1) {
    violations.push({
      code: "INVALID_CONCURRENCY",
      severity: "blocking",
      message: "maxConcurrentRequests must be at least 1.",
      field: "resilience.maxConcurrentRequests",
    });
  }

  if (mission.budget.maxPages < 1 || mission.budget.maxRequests < 1) {
    violations.push({
      code: "INVALID_BUDGET",
      severity: "blocking",
      message: "Page and request budgets must be positive.",
      field: "budget",
    });
  }

  if (mission.allowAuthenticatedPages) {
    requiredApprovals.add("data-owner");
    requiredApprovals.add("security");
  }

  if (mission.dataClassification === "confidential") {
    requiredApprovals.add("data-steward");
  }

  if (mission.dataClassification === "restricted") {
    requiredApprovals.add("data-steward");
    requiredApprovals.add("security");
    requiredApprovals.add("legal-or-compliance");
  }

  if (mission.publicationAllowed) {
    requiredApprovals.add("dataset-publication");
  }

  if (mission.humanApprovalRequired) {
    requiredApprovals.add("mission-owner");
  }

  return {
    approved: !violations.some((violation) => violation.severity === "blocking"),
    violations,
    normalizedDomains: allowedDomains,
    requiredApprovals: [...requiredApprovals].sort(),
  };
}

export function computeBackoffDelayMs(
  attempt: number,
  policy: AccessResiliencePolicy,
  retryAfterHeader?: string,
): number {
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1_000, policy.maxBackoffMs);
    }

    const date = Date.parse(retryAfterHeader);
    if (!Number.isNaN(date)) {
      return Math.min(Math.max(0, date - Date.now()), policy.maxBackoffMs);
    }
  }

  const exponent = Math.max(0, attempt - 1);
  const baseDelay =
    policy.backoffBaseMs * Math.pow(policy.backoffMultiplier, exponent);
  const deterministicJitter = Math.min(policy.jitterMs, attempt * 37);
  return Math.min(baseDelay + deterministicJitter, policy.maxBackoffMs);
}

export function decideAccessResponse(
  signal: AccessResponseSignal,
  attempt: number,
  consecutiveFailures: number,
  policy: AccessResiliencePolicy,
): AccessDecisionResult {
  if (signal.detectedCaptcha) {
    return {
      decision: "manual-review",
      reason: "CAPTCHA detected; automated execution must stop.",
    };
  }

  if (signal.detectedAuthenticationChallenge) {
    return {
      decision: "manual-review",
      reason: "Authentication challenge detected; authorization must be reviewed.",
    };
  }

  if (signal.detectedExplicitBlock) {
    return {
      decision: "stop",
      reason: "Explicit block or deny signal detected.",
    };
  }

  if (consecutiveFailures >= policy.circuitBreakerFailureThreshold) {
    return {
      decision: "open-circuit",
      reason: "Failure threshold reached; pause access for the configured cooldown.",
      retryAfterMs: policy.circuitBreakerCooldownMs,
    };
  }

  const statusCode = signal.statusCode;
  const retryable =
    signal.networkError ||
    (typeof statusCode === "number" &&
      policy.retryableStatusCodes.includes(statusCode));

  if (retryable && attempt < policy.maxRetries) {
    const retryAfter = signal.responseHeaders?.["retry-after"];
    return {
      decision: "retry-with-backoff",
      reason: `Transient access failure${statusCode ? ` (${statusCode})` : ""}.`,
      retryAfterMs: computeBackoffDelayMs(attempt + 1, policy, retryAfter),
    };
  }

  if (retryable) {
    return {
      decision: "stop",
      reason: "Retry budget exhausted.",
    };
  }

  if (typeof statusCode === "number" && statusCode >= 200 && statusCode < 400) {
    return {
      decision: "accept",
      reason: "Response accepted within policy.",
    };
  }

  return {
    decision: "stop",
    reason: `Non-retryable response${statusCode ? ` (${statusCode})` : ""}.`,
  };
}

export function selectAcquisitionProvider(input: {
  requiresJavascript: boolean;
  requiresStatefulBrowser: boolean;
  knownStaticSource: boolean;
  providerPreference: AcquisitionProvider[];
  providerAvailability: Partial<Record<AcquisitionProvider, boolean>>;
}): AcquisitionProvider {
  const preferred = input.providerPreference.filter(
    (provider) => input.providerAvailability[provider] !== false,
  );

  const candidates: AcquisitionProvider[] = input.requiresStatefulBrowser
    ? ["firecrawl", "browserless", "manual-review"]
    : input.requiresJavascript
      ? ["crawlee", "firecrawl", "browserless", "manual-review"]
      : input.knownStaticSource
        ? ["native-http", "crawlee", "firecrawl", "manual-review"]
        : ["crawlee", "firecrawl", "native-http", "manual-review"];

  for (const candidate of preferred) {
    if (candidates.includes(candidate)) {
      return candidate;
    }
  }

  for (const candidate of candidates) {
    if (input.providerAvailability[candidate] !== false) {
      return candidate;
    }
  }

  return "manual-review";
}
