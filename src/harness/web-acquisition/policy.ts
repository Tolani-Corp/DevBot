import type {
  AcquisitionAttempt,
  AcquisitionDecision,
  AcquisitionProviderKind,
  AntiBlockingPolicy,
  BlockSignal,
  DomainAccessPolicy,
  WebAcquisitionMission,
} from "./types.js";

const TRANSIENT_SIGNALS = new Set<BlockSignal>([
  "network-timeout",
  "provider-failure",
  "rendering-failure",
]);

const TERMINAL_SIGNALS = new Set<BlockSignal>([
  "access-denied",
  "authentication-required",
  "legal-restriction",
  "robots-disallowed",
  "captcha-or-challenge",
]);

export function createDefaultAntiBlockingPolicy(): AntiBlockingPolicy {
  return {
    schema: "tolani.natt.web-acquisition-policy.v1",
    transparentUserAgent: "TolaniResearchBot/1.0 (+https://tolanicorp.us/bot-policy)",
    contactUrl: "https://tolanicorp.us/contact",
    cache: {
      enabled: true,
      ttlSeconds: 86_400,
      staleWhileRevalidateSeconds: 604_800,
      useContentHash: true,
      canonicalizeUrls: true,
      deduplicateAcrossMissions: true,
    },
    retry: {
      maxAttemptsPerUrl: 3,
      baseDelayMs: 2_000,
      maxDelayMs: 120_000,
      exponentialFactor: 2,
      jitterRatio: 0.2,
      retryableStatusCodes: [408, 425, 429, 500, 502, 503, 504],
      terminalStatusCodes: [400, 401, 403, 404, 405, 410, 451],
      honorRetryAfter: true,
    },
    circuitBreaker: {
      enabled: true,
      failureThreshold: 5,
      observationWindowSeconds: 300,
      openDurationSeconds: 900,
      halfOpenProbeCount: 1,
    },
    providerFallback: {
      enabled: true,
      providerOrder: ["native-http", "crawlee", "firecrawl", "browserless"],
      allowedReasons: ["network-timeout", "provider-failure", "rendering-failure"],
      forbiddenReasons: [
        "access-denied",
        "authentication-required",
        "legal-restriction",
        "robots-disallowed",
        "captcha-or-challenge",
        "rate-limited",
      ],
    },
    proxy: {
      mode: "provider-managed",
      rotationAllowed: false,
      geographicTargetingAllowed: false,
      forbiddenPurposes: [
        "evade-access-controls",
        "circumvent-rate-limits",
        "bypass-geofencing",
        "conceal-identity",
      ],
    },
    prohibitedTechniques: [
      "captcha-bypass",
      "credential-stuffing",
      "authentication-bypass",
      "browser-fingerprint-spoofing",
      "header-rotation-to-impersonate-users",
      "residential-proxy-rotation-for-evasion",
      "robots-disallow-circumvention",
      "session-token-theft",
    ],
    approvalTriggers: [
      "authenticated-content",
      "terms-unclear",
      "restricted-data",
      "provider-cost-overrun",
      "legal-or-policy-block",
    ],
  };
}

export function validateWebAcquisitionMission(mission: WebAcquisitionMission): string[] {
  const errors: string[] = [];

  if (mission.schema !== "tolani.natt.web-acquisition-mission.v1") {
    errors.push("Unsupported mission schema");
  }
  if (!mission.missionId.trim()) errors.push("missionId is required");
  if (!mission.tenantId.trim()) errors.push("tenantId is required");
  if (!mission.requestedBy.trim()) errors.push("requestedBy is required");
  if (mission.startUrls.length === 0) errors.push("At least one start URL is required");
  if (mission.allowedDomains.length === 0) errors.push("At least one allowed domain is required");
  if (mission.cost.maxPages <= 0) errors.push("maxPages must be greater than zero");
  if (mission.cost.maxRuntimeSeconds <= 0) {
    errors.push("maxRuntimeSeconds must be greater than zero");
  }

  const now = Date.now();
  const expiresAt = Date.parse(mission.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    errors.push("Mission expiration must be a valid future timestamp");
  }

  for (const url of mission.startUrls) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      errors.push(`Invalid start URL: ${url}`);
      continue;
    }

    if (!isAllowedScheme(parsed)) {
      errors.push(`Unsupported URL scheme for ${url}`);
    }
    if (!domainMatches(parsed.hostname, mission.allowedDomains)) {
      errors.push(`Start URL domain is not allowlisted: ${parsed.hostname}`);
    }
    if (domainMatches(parsed.hostname, mission.deniedDomains)) {
      errors.push(`Start URL domain is explicitly denied: ${parsed.hostname}`);
    }
  }

  for (const domain of mission.allowedDomains) {
    const policy = findDomainPolicy(domain, mission.domainPolicies);
    if (!policy) {
      errors.push(`Missing domain access policy for ${domain}`);
      continue;
    }
    if (!policy.allowed) errors.push(`Allowlisted domain is disabled by policy: ${domain}`);
    if (policy.respectRobotsTxt !== true) {
      errors.push(`robots.txt enforcement must remain enabled for ${domain}`);
    }
    if (!policy.lawfulBasis.trim()) errors.push(`lawfulBasis is required for ${domain}`);
    if (policy.requestsPerMinute <= 0) {
      errors.push(`requestsPerMinute must be greater than zero for ${domain}`);
    }
    if (policy.maxConcurrency <= 0) {
      errors.push(`maxConcurrency must be greater than zero for ${domain}`);
    }
  }

  if (mission.dataClassification === "restricted" && !mission.humanApprovalRequired) {
    errors.push("Restricted-data missions require human approval");
  }
  if (mission.allowAuthenticatedContent && !mission.humanApprovalRequired) {
    errors.push("Authenticated-content missions require human approval");
  }

  return errors;
}

export function evaluateAcquisitionAttempt(
  mission: WebAcquisitionMission,
  policy: AntiBlockingPolicy,
  attempt: AcquisitionAttempt,
): AcquisitionDecision {
  const missionErrors = validateWebAcquisitionMission(mission);
  if (missionErrors.length > 0) {
    return stop("mission-invalid", missionErrors.join("; "), true, ["validation"]);
  }

  const parsed = safeUrl(attempt.url);
  if (!parsed) return stop("url-invalid", "The acquisition URL is invalid", false, ["validation"]);

  if (!domainMatches(parsed.hostname, mission.allowedDomains)) {
    return stop("domain-not-allowlisted", "The target domain is not allowlisted", true, ["scope"]);
  }
  if (domainMatches(parsed.hostname, mission.deniedDomains)) {
    return stop("domain-denied", "The target domain is explicitly denied", true, ["scope"]);
  }

  const domainPolicy = findDomainPolicy(parsed.hostname, mission.domainPolicies);
  if (!domainPolicy?.allowed) {
    return stop("domain-policy-missing", "No active domain policy authorizes this target", true, ["scope"]);
  }

  const pathDecision = evaluatePath(parsed.pathname, domainPolicy);
  if (pathDecision) return pathDecision;

  if (attempt.cacheHit && attempt.cacheFresh && policy.cache.enabled) {
    return {
      action: "use-cache",
      reasonCode: "fresh-cache-hit",
      reason: "A fresh, policy-compliant cached result is available",
      requiresHumanApproval: false,
      auditTags: ["cache", "cost-control"],
    };
  }

  if (attempt.robotsDecision === "unknown") {
    return {
      action: "request-approval",
      reasonCode: "robots-preflight-required",
      reason: "Resolve robots.txt policy before requesting the target",
      requiresHumanApproval: false,
      auditTags: ["robots", "preflight"],
    };
  }
  if (attempt.robotsDecision === "disallowed") {
    return stop(
      "robots-disallowed",
      "robots.txt disallows acquisition of this URL",
      true,
      ["robots", "terminal"],
    );
  }

  const budgetDecision = evaluateBudget(mission, attempt);
  if (budgetDecision) return budgetDecision;

  if (
    policy.circuitBreaker.enabled &&
    attempt.priorFailuresForDomain >= policy.circuitBreaker.failureThreshold
  ) {
    return stop(
      "domain-circuit-open",
      "The domain circuit breaker is open after repeated failures",
      true,
      ["circuit-breaker", "reliability"],
    );
  }

  if (attempt.concurrentRequestsForDomain >= domainPolicy.maxConcurrency) {
    return delay(
      "domain-concurrency-limit",
      "Domain concurrency is at the configured limit",
      domainPolicy.minDelayMs,
      ["rate-limit", "concurrency"],
    );
  }

  if (attempt.requestsInLastMinute >= domainPolicy.requestsPerMinute) {
    return delay(
      "domain-rate-limit",
      "Domain request rate is at the configured limit",
      Math.max(domainPolicy.minDelayMs, 60_000 / domainPolicy.requestsPerMinute),
      ["rate-limit", "cooperative-access"],
    );
  }

  const signal = normalizeBlockSignal(attempt);
  if (TERMINAL_SIGNALS.has(signal)) {
    return stop(
      signal,
      terminalSignalReason(signal),
      true,
      ["terminal", "no-circumvention"],
    );
  }

  if (signal === "rate-limited" || attempt.statusCode === 429) {
    const retryAfterMs = Math.max(0, (attempt.retryAfterSeconds ?? 60) * 1_000);
    return delay(
      "rate-limited",
      "The target requested reduced traffic; honor Retry-After before any retry",
      Math.max(retryAfterMs, domainPolicy.minDelayMs),
      ["rate-limit", "retry-after"],
    );
  }

  if (attempt.statusCode && policy.retry.terminalStatusCodes.includes(attempt.statusCode)) {
    return stop(
      `terminal-http-${attempt.statusCode}`,
      `HTTP ${attempt.statusCode} is terminal under the acquisition policy`,
      attempt.statusCode === 401 || attempt.statusCode === 403 || attempt.statusCode === 451,
      ["http", "terminal"],
    );
  }

  if (isTransient(attempt, policy)) {
    if (attempt.attemptNumber >= policy.retry.maxAttemptsPerUrl) {
      return stop(
        "retry-budget-exhausted",
        "The retry budget for this URL is exhausted",
        false,
        ["retry", "budget"],
      );
    }

    const nextProvider = selectFallbackProvider(attempt.provider, signal, policy, domainPolicy);
    if (nextProvider) {
      return {
        action: "fallback-provider",
        reasonCode: `fallback-${signal}`,
        reason: "Use an approved provider fallback for a transient technical failure",
        nextProvider,
        requiresHumanApproval: false,
        auditTags: ["provider-fallback", "transient-only"],
      };
    }

    return {
      action: "retry",
      reasonCode: `retry-${signal}`,
      reason: "Retry the transient failure with bounded exponential backoff",
      delayMs: calculateBackoffMs(attempt.attemptNumber, policy),
      requiresHumanApproval: false,
      auditTags: ["retry", "bounded-backoff"],
    };
  }

  return {
    action: "allow",
    reasonCode: "policy-authorized",
    reason: "The request is within scope, budget, rate and access-control policy",
    delayMs: domainPolicy.minDelayMs,
    requiresHumanApproval: mission.humanApprovalRequired,
    auditTags: ["authorized", "cooperative-access"],
  };
}

export function calculateBackoffMs(attemptNumber: number, policy: AntiBlockingPolicy): number {
  const exponent = Math.max(0, attemptNumber - 1);
  const raw = Math.min(
    policy.retry.maxDelayMs,
    policy.retry.baseDelayMs * policy.retry.exponentialFactor ** exponent,
  );
  const jitter = raw * policy.retry.jitterRatio;
  return Math.round(Math.max(0, raw + deterministicJitter(attemptNumber, jitter)));
}

function evaluateBudget(
  mission: WebAcquisitionMission,
  attempt: AcquisitionAttempt,
): AcquisitionDecision | undefined {
  const exceeded =
    attempt.pagesConsumed >= mission.cost.maxPages ||
    attempt.providerCreditsConsumed >= mission.cost.maxProviderCredits ||
    attempt.browserMinutesConsumed >= mission.cost.maxBrowserMinutes ||
    attempt.toolCallsConsumed >= mission.cost.maxToolCalls ||
    attempt.costUsdConsumed >= mission.cost.maxCostUsd;

  if (!exceeded) return undefined;

  if (mission.cost.budgetAction === "request-approval") {
    return {
      action: "request-approval",
      reasonCode: "budget-exhausted",
      reason: "The acquisition cost envelope is exhausted",
      requiresHumanApproval: true,
      auditTags: ["budget", "approval"],
    };
  }

  return stop(
    "budget-exhausted",
    "The acquisition cost envelope is exhausted",
    false,
    ["budget", mission.cost.budgetAction],
  );
}

function evaluatePath(pathname: string, policy: DomainAccessPolicy): AcquisitionDecision | undefined {
  const denied = policy.deniedPaths?.some((prefix) => pathname.startsWith(prefix));
  if (denied) {
    return stop("path-denied", "The target path is denied by domain policy", true, ["scope", "path"]);
  }

  if (policy.allowedPaths && policy.allowedPaths.length > 0) {
    const allowed = policy.allowedPaths.some((prefix) => pathname.startsWith(prefix));
    if (!allowed) {
      return stop(
        "path-not-allowlisted",
        "The target path is outside the domain allowlist",
        true,
        ["scope", "path"],
      );
    }
  }

  return undefined;
}

function normalizeBlockSignal(attempt: AcquisitionAttempt): BlockSignal {
  if (attempt.blockSignal && attempt.blockSignal !== "none") return attempt.blockSignal;
  switch (attempt.statusCode) {
    case 401:
      return "authentication-required";
    case 403:
      return "access-denied";
    case 429:
      return "rate-limited";
    case 451:
      return "legal-restriction";
    default:
      return "none";
  }
}

function isTransient(attempt: AcquisitionAttempt, policy: AntiBlockingPolicy): boolean {
  const signal = normalizeBlockSignal(attempt);
  if (TRANSIENT_SIGNALS.has(signal)) return true;
  return attempt.statusCode
    ? policy.retry.retryableStatusCodes.includes(attempt.statusCode) && attempt.statusCode !== 429
    : false;
}

function selectFallbackProvider(
  current: AcquisitionProviderKind,
  signal: BlockSignal,
  policy: AntiBlockingPolicy,
  domainPolicy: DomainAccessPolicy,
): AcquisitionProviderKind | undefined {
  if (!policy.providerFallback.enabled) return undefined;
  if (!policy.providerFallback.allowedReasons.includes(signal as never)) return undefined;
  if (policy.providerFallback.forbiddenReasons.includes(signal as never)) return undefined;

  const approved = new Set(
    domainPolicy.approvedProviders ?? policy.providerFallback.providerOrder,
  );
  const currentIndex = policy.providerFallback.providerOrder.indexOf(current);

  return policy.providerFallback.providerOrder
    .slice(Math.max(0, currentIndex + 1))
    .find((provider) => approved.has(provider));
}

function terminalSignalReason(signal: BlockSignal): string {
  switch (signal) {
    case "access-denied":
      return "The target denied access; do not switch identities or providers to circumvent it";
    case "authentication-required":
      return "The target requires authentication not authorized by this mission";
    case "legal-restriction":
      return "The target reported a legal restriction";
    case "robots-disallowed":
      return "robots.txt disallows acquisition";
    case "captcha-or-challenge":
      return "A CAPTCHA or challenge was detected; automated bypass is prohibited";
    default:
      return "The acquisition encountered a terminal access-control signal";
  }
}

function stop(
  reasonCode: string,
  reason: string,
  requiresHumanApproval: boolean,
  auditTags: string[],
): AcquisitionDecision {
  return {
    action: "stop",
    reasonCode,
    reason,
    requiresHumanApproval,
    auditTags,
  };
}

function delay(
  reasonCode: string,
  reason: string,
  delayMs: number,
  auditTags: string[],
): AcquisitionDecision {
  return {
    action: "delay",
    reasonCode,
    reason,
    delayMs: Math.ceil(delayMs),
    requiresHumanApproval: false,
    auditTags,
  };
}

function safeUrl(value: string): URL | undefined {
  try {
    const parsed = new URL(value);
    return isAllowedScheme(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isAllowedScheme(url: URL): boolean {
  return url.protocol === "https:" ||
    (url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname));
}

function findDomainPolicy(
  hostname: string,
  policies: DomainAccessPolicy[],
): DomainAccessPolicy | undefined {
  return policies.find((policy) => domainMatches(hostname, [policy.domain]));
}

function domainMatches(hostname: string, domains: string[]): boolean {
  const normalizedHost = hostname.toLowerCase().replace(/^www\./, "");
  return domains.some((domain) => {
    const normalizedDomain = domain.toLowerCase().replace(/^www\./, "");
    return normalizedHost === normalizedDomain || normalizedHost.endsWith(`.${normalizedDomain}`);
  });
}

function deterministicJitter(seed: number, maximum: number): number {
  if (maximum <= 0) return 0;
  const normalized = Math.sin(seed * 12.9898) * 43758.5453;
  const fraction = normalized - Math.floor(normalized);
  return maximum * (fraction * 2 - 1);
}
