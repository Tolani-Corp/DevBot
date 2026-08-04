export type AcquisitionPurpose =
  | "research"
  | "supplier-validation"
  | "regulatory-monitoring"
  | "competitive-intelligence"
  | "dataset-development"
  | "security-assessment";

export type DataClassification =
  | "public"
  | "internal"
  | "confidential"
  | "restricted";

export type AcquisitionProviderKind =
  | "native-http"
  | "crawlee"
  | "firecrawl"
  | "browserless"
  | "apify"
  | "custom";

export type RobotsDecision = "allowed" | "disallowed" | "unknown" | "not-applicable";

export type AcquisitionAction =
  | "allow"
  | "use-cache"
  | "delay"
  | "retry"
  | "fallback-provider"
  | "request-approval"
  | "stop";

export type BlockSignal =
  | "none"
  | "rate-limited"
  | "access-denied"
  | "authentication-required"
  | "legal-restriction"
  | "robots-disallowed"
  | "captcha-or-challenge"
  | "network-timeout"
  | "provider-failure"
  | "rendering-failure"
  | "budget-exhausted"
  | "domain-circuit-open";

export interface CostEnvelope {
  maxCostUsd: number;
  maxPages: number;
  maxProviderCredits: number;
  maxBrowserMinutes: number;
  maxToolCalls: number;
  maxRuntimeSeconds: number;
  budgetAction:
    | "stop"
    | "request-approval"
    | "downgrade-provider"
    | "return-partial-result";
}

export interface DomainAccessPolicy {
  domain: string;
  allowed: boolean;
  respectRobotsTxt: true;
  termsReviewed: boolean;
  lawfulBasis: string;
  requestsPerMinute: number;
  maxConcurrency: number;
  minDelayMs: number;
  allowedPaths?: string[];
  deniedPaths?: string[];
  approvedProviders?: AcquisitionProviderKind[];
  expiresAt?: string;
}

export interface ProxyPolicy {
  mode: "none" | "corporate-egress" | "provider-managed";
  rotationAllowed: false;
  geographicTargetingAllowed: boolean;
  approvedCountries?: string[];
  forbiddenPurposes: Array<
    | "evade-access-controls"
    | "circumvent-rate-limits"
    | "bypass-geofencing"
    | "conceal-identity"
  >;
}

export interface CachePolicy {
  enabled: boolean;
  ttlSeconds: number;
  staleWhileRevalidateSeconds: number;
  useContentHash: boolean;
  canonicalizeUrls: boolean;
  deduplicateAcrossMissions: boolean;
}

export interface RetryPolicy {
  maxAttemptsPerUrl: number;
  baseDelayMs: number;
  maxDelayMs: number;
  exponentialFactor: number;
  jitterRatio: number;
  retryableStatusCodes: number[];
  terminalStatusCodes: number[];
  honorRetryAfter: true;
}

export interface CircuitBreakerPolicy {
  enabled: boolean;
  failureThreshold: number;
  observationWindowSeconds: number;
  openDurationSeconds: number;
  halfOpenProbeCount: number;
}

export interface ProviderFallbackPolicy {
  enabled: boolean;
  providerOrder: AcquisitionProviderKind[];
  allowedReasons: Array<"network-timeout" | "provider-failure" | "rendering-failure">;
  forbiddenReasons: Array<
    | "access-denied"
    | "authentication-required"
    | "legal-restriction"
    | "robots-disallowed"
    | "captcha-or-challenge"
    | "rate-limited"
  >;
}

export interface AntiBlockingPolicy {
  schema: "tolani.natt.web-acquisition-policy.v1";
  transparentUserAgent: string;
  contactUrl?: string;
  cache: CachePolicy;
  retry: RetryPolicy;
  circuitBreaker: CircuitBreakerPolicy;
  providerFallback: ProviderFallbackPolicy;
  proxy: ProxyPolicy;
  prohibitedTechniques: Array<
    | "captcha-bypass"
    | "credential-stuffing"
    | "authentication-bypass"
    | "browser-fingerprint-spoofing"
    | "header-rotation-to-impersonate-users"
    | "residential-proxy-rotation-for-evasion"
    | "robots-disallow-circumvention"
    | "session-token-theft"
  >;
  approvalTriggers: Array<
    | "authenticated-content"
    | "terms-unclear"
    | "restricted-data"
    | "provider-cost-overrun"
    | "legal-or-policy-block"
  >;
}

export interface WebAcquisitionMission {
  schema: "tolani.natt.web-acquisition-mission.v1";
  missionId: string;
  tenantId: string;
  requestedBy: string;
  purpose: AcquisitionPurpose;
  startUrls: string[];
  allowedDomains: string[];
  deniedDomains: string[];
  domainPolicies: DomainAccessPolicy[];
  dataClassification: DataClassification;
  allowAuthenticatedContent: boolean;
  allowBrowserInteraction: boolean;
  publicationAllowed: boolean;
  humanApprovalRequired: boolean;
  outputFormats: Array<"markdown" | "html" | "json" | "screenshot" | "links">;
  cost: CostEnvelope;
  createdAt: string;
  expiresAt: string;
}

export interface AcquisitionAttempt {
  url: string;
  provider: AcquisitionProviderKind;
  attemptNumber: number;
  priorFailuresForDomain: number;
  requestsInLastMinute: number;
  concurrentRequestsForDomain: number;
  robotsDecision: RobotsDecision;
  cacheHit: boolean;
  cacheFresh: boolean;
  statusCode?: number;
  retryAfterSeconds?: number;
  blockSignal?: BlockSignal;
  elapsedMs?: number;
  pagesConsumed: number;
  providerCreditsConsumed: number;
  browserMinutesConsumed: number;
  toolCallsConsumed: number;
  costUsdConsumed: number;
}

export interface AcquisitionDecision {
  action: AcquisitionAction;
  reasonCode: string;
  reason: string;
  delayMs?: number;
  nextProvider?: AcquisitionProviderKind;
  requiresHumanApproval: boolean;
  auditTags: string[];
}

export interface AcquisitionAuditEvent {
  schema: "tolani.harness.audit-event.v1";
  eventId: string;
  missionId: string;
  tenantId: string;
  eventType:
    | "acquisition.authorized"
    | "acquisition.delayed"
    | "acquisition.retried"
    | "acquisition.provider-fallback"
    | "acquisition.blocked"
    | "acquisition.completed";
  actorType: "user" | "agent" | "service";
  actorId: string;
  urlHash: string;
  provider?: AcquisitionProviderKind;
  reasonCode: string;
  metadata: Record<string, string | number | boolean | null>;
  occurredAt: string;
}
