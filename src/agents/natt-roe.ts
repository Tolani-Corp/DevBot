import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { evaluateTargetScope, type NetworkScopePolicy } from "../security/network-scope.js";

export type ROEClassification = "public" | "confidential" | "restricted" | "secret";

export type ROEStatus =
  | "draft"
  | "pending-approval"
  | "approved"
  | "active"
  | "suspended"
  | "expired"
  | "revoked";

export type ROEViolationType =
  | "out-of-scope-target"
  | "unauthorized-technique"
  | "outside-time-window"
  | "missing-authorization"
  | "expired-engagement"
  | "banned-target"
  | "jurisdiction-mismatch"
  | "operator-unverified"
  | "destructive-action-blocked"
  | "concurrent-mission-limit";

export interface ROEScope extends NetworkScopePolicy {}

export interface ROETimeWindow {
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  timezone: string;
}

export interface ROEContact {
  role: "primary" | "technical" | "emergency" | "legal";
  name: string;
  email: string;
  phone?: string;
  responseTimeMins: number;
}

export interface AuthorizationVerification {
  status: "verified" | "failed" | "expired";
  keyId: string;
  algorithm: "PS256" | "RS256" | "ES256";
  signerId: string;
  signerRole: "asset-owner" | "delegated-authorizer";
  signedAt: string;
  expiresAt?: string;
  verifiedAt: string;
  manifestHash: string;
}

export interface ROEEngagement {
  id: string;
  name: string;
  classification: ROEClassification;
  status: ROEStatus;
  operator: {
    id: string;
    name: string;
    organization: string;
    credential: string;
  };
  client: {
    name: string;
    contactEmail: string;
    authorizingOfficer: string;
  };
  legal: {
    jurisdiction: string;
    contractRef: string;
    authDocHash?: string;
    authorizationVerification?: AuthorizationVerification;
  };
  scope: ROEScope;
  timeWindows: ROETimeWindow[];
  contacts: ROEContact[];
  forbiddenTechniques: string[];
  permittedMissionTypes: string[];
  maxGhostMode: "passive" | "stealth" | "active";
  validFrom: Date;
  validUntil: Date;
  /** SHA-256 hash only. Plaintext passphrases are never persisted by this implementation. */
  missionPassphraseHash: string;
  /** Deprecated legacy field accepted only while old records are migrated. */
  missionPassphrase?: string;
  createdAt: Date;
  updatedAt: Date;
  auditLog: ROEAuditEntry[];
}

export interface ROEAuditEntry {
  timestamp: Date;
  event: string;
  operator: string;
  target?: string;
  detail: string;
  severity: "info" | "warning" | "violation" | "critical";
}

export interface ROEValidationResult {
  approved: boolean;
  engagementId: string;
  validatedAt: Date;
  checks: ROECheck[];
  violations: ROEViolation[];
  missionGuidance: MissionGuidance;
  operatorBrief: string;
}

export interface ROECheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface ROEViolation {
  type: ROEViolationType;
  severity: "blocking" | "warning";
  message: string;
  remediation: string;
}

export interface MissionGuidance {
  brief: string;
  objectives: string[];
  hardLimits: string[];
  escalationTriggers: string[];
  approvedTechniques: string[];
  breakGlassProtocol: string;
  evidenceRequirements: string[];
}

export interface PhaseROEGate {
  phase: string;
  target: string;
  technique: string;
  approved: boolean;
  reason: string;
}

const MISSION_GUIDANCE_TEMPLATES: Record<string, Omit<MissionGuidance, "brief">> = {
  "web-app": {
    objectives: [
      "Inventory authorized web entry points",
      "Assess OWASP-aligned controls",
      "Validate authentication, authorization, session, transport, and browser controls",
    ],
    hardLimits: [
      "Use synthetic data and client-provisioned test identities only",
      "Do not trigger financial, messaging, deletion, or other irreversible actions",
      "Do not retain credentials, full tokens, unrelated personal data, or production records",
      "Stop on instability, unexpected production-user access, or critical uncontrolled access",
    ],
    escalationTriggers: [
      "Critical access-control failure",
      "Unexpected access to production data",
      "Evidence of an active third-party intrusion",
      "Any effect on service availability",
    ],
    approvedTechniques: [
      "Passive crawling within approved paths",
      "Header and cookie analysis",
      "Non-destructive input validation with test data",
      "Authentication and authorization validation using test identities",
    ],
    breakGlassProtocol:
      "Stop the mission, preserve minimum necessary evidence, invoke the engagement emergency contact, and await written restart approval.",
    evidenceRequirements: [
      "Timestamped sanitized request and response evidence",
      "Exact affected asset and approved test identity reference",
      "Reproduction steps that do not expose secrets or real customer data",
    ],
  },
  "html-analysis": {
    objectives: ["Review supplied HTML and browser controls", "Identify unsafe DOM patterns", "Assess CSP and transport posture"],
    hardLimits: ["Analyze only supplied or authorized content", "Do not execute unknown active content outside an isolated sandbox"],
    escalationTriggers: ["Embedded live credentials or tokens", "Unexpected production connectivity"],
    approvedTechniques: ["Static analysis", "Sandboxed rendering", "Security-header review"],
    breakGlassProtocol: "Stop rendering, isolate the artifact, and notify the technical contact.",
    evidenceRequirements: ["Sanitized code excerpt", "File hash", "Affected line or DOM location"],
  },
  "api-recon": {
    objectives: ["Inventory approved API endpoints", "Assess authentication and authorization", "Validate rate limiting and data minimization"],
    hardLimits: [
      "Do not call irreversible endpoints",
      "Do not cross tenant boundaries except between synthetic test tenants",
      "Respect the lower of the ROE rate limit or server-provided backoff",
    ],
    escalationTriggers: ["Unauthenticated administrative access", "Real cross-tenant data exposure", "Service degradation"],
    approvedTechniques: ["OpenAPI review", "Method and parameter validation", "Test-identity authorization checks"],
    breakGlassProtocol: "Stop all requests, retain only the last necessary sanitized exchanges, and contact the technical owner.",
    evidenceRequirements: ["Endpoint inventory", "Sanitized request-response pair", "Role and tenant test matrix"],
  },
  "network-recon": {
    objectives: ["Map authorized hosts and services", "Assess exposed ports and TLS posture", "Identify configuration weaknesses"],
    hardLimits: [
      "Do not scan outside exact domain, IP, CIDR, port, and time scope",
      "No denial-of-service, flooding, destructive testing, or exploitation without an explicit clause",
      "Honor approved concurrency and packet-rate limits",
    ],
    escalationTriggers: ["Industrial or safety-critical systems", "Unexpected third-party infrastructure", "Availability impact"],
    approvedTechniques: ["Bounded host discovery", "Approved TCP service discovery", "TLS and banner assessment"],
    breakGlassProtocol: "Terminate the isolated scanner process and contact the emergency technical owner.",
    evidenceRequirements: ["Command/profile identifier", "Authorized scope rule", "Sanitized service inventory"],
  },
  osint: {
    objectives: ["Map public digital exposure", "Identify public source risks", "Preserve source provenance"],
    hardLimits: ["Public sources only", "No deceptive identity, contact, login, or access-control circumvention"],
    escalationTriggers: ["Leaked live credentials", "Active fraud or intrusion indicators", "Sensitive personal data exposure"],
    approvedTechniques: ["Public search", "DNS and certificate transparency", "Public repository review"],
    breakGlassProtocol: "Cease collection and escalate without redistributing sensitive material.",
    evidenceRequirements: ["Source URL", "Retrieval timestamp", "Classification and redaction record"],
  },
  "auth-testing": {
    objectives: ["Assess password and login controls", "Validate MFA, recovery, OAuth/OIDC, and session controls", "Confirm lockout-safe defenses"],
    hardLimits: [
      "Use client-provisioned or synthetic test identities only",
      "Never collect or retain real passwords, recovery codes, or full session tokens",
      "Maximum five attempts per test identity unless a lower contract limit applies",
      "Stop immediately on lockout or unexpected production-user access",
    ],
    escalationTriggers: ["Authentication bypass affecting non-test users", "Hardcoded privileged credential", "Session issued outside approved test identity"],
    approvedTechniques: ["Test-account enumeration resistance", "MFA and recovery-flow validation", "Session lifecycle validation"],
    breakGlassProtocol: "Stop authentication traffic, revoke test sessions, and notify the identity owner.",
    evidenceRequirements: ["Test identity reference", "Redacted protocol exchange", "Attempt count and lockout observation"],
  },
  "platform-detection": {
    objectives: ["Identify technologies exposed by approved targets", "Assess version and configuration disclosure"],
    hardLimits: ["Passive and low-impact fingerprinting only", "No exploit execution"],
    escalationTriggers: ["Safety-critical platform", "Out-of-scope managed service"],
    approvedTechniques: ["Header analysis", "Static asset fingerprinting", "TLS metadata review"],
    breakGlassProtocol: "Stop probes and validate ownership with the client technical contact.",
    evidenceRequirements: ["Observed fingerprint", "Confidence level", "Source response metadata"],
  },
  "code-analysis": {
    objectives: ["Review client-supplied code and configuration", "Identify secrets and vulnerable dependencies", "Produce remediation guidance"],
    hardLimits: ["Read only approved repositories and revisions", "Do not copy secrets into findings or prompts"],
    escalationTriggers: ["Live credential", "Malicious implant", "Evidence of active compromise"],
    approvedTechniques: ["Static analysis", "Dependency audit", "Secret-pattern detection with redaction"],
    breakGlassProtocol: "Quarantine the finding metadata and notify the repository owner.",
    evidenceRequirements: ["Repository and commit", "Redacted location", "Scanner version and rule identifier"],
  },
  "racing-recon": {
    objectives: ["Run bounded comparative reconnaissance", "Measure approved control behavior under controlled concurrency"],
    hardLimits: ["No uncontrolled concurrency", "No availability degradation", "Stop on rate-limit or instability signal"],
    escalationTriggers: ["HTTP 429 without recovery", "Latency or error-rate impact", "Scope drift"],
    approvedTechniques: ["Rate-limited parallel discovery", "Comparative response analysis"],
    breakGlassProtocol: "Cancel every worker and notify the emergency technical contact.",
    evidenceRequirements: ["Concurrency profile", "Request rate", "Latency and error observations"],
  },
  "full-ghost": {
    objectives: ["Perform the expressly approved multi-surface assessment", "Identify attack paths", "Prioritize remediation"],
    hardLimits: [
      "All mission-specific hard limits apply",
      "No autonomous scope expansion, persistence, destructive action, denial-of-service, or real-data exfiltration",
      "Critical findings pause the mission pending written direction",
    ],
    escalationTriggers: ["Any critical finding", "Active compromise evidence", "System instability", "Scope ambiguity"],
    approvedTechniques: ["Only techniques individually permitted by the signed ROE"],
    breakGlassProtocol: "Stop every isolated execution, preserve the audit trail, and contact all named emergency stakeholders.",
    evidenceRequirements: ["Complete tested-scope record", "Sanitized finding evidence", "Attack-path and remediation narrative"],
  },
};

const ROE_DIR = path.join(process.cwd(), ".natt", "roe");
const MODE_ORDER: Record<"passive" | "stealth" | "active", number> = { passive: 0, stealth: 1, active: 2 };

function passphraseHash(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function timingSafeHexEqual(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) return false;
  return crypto.timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function engagementPassphraseHash(engagement: ROEEngagement): string | undefined {
  if (/^[a-f0-9]{64}$/i.test(engagement.missionPassphraseHash ?? "")) return engagement.missionPassphraseHash;
  if (engagement.missionPassphrase) return passphraseHash(engagement.missionPassphrase);
  return undefined;
}

async function ensureROEDir(): Promise<void> {
  await fs.mkdir(ROE_DIR, { recursive: true });
}

export async function saveEngagement(engagement: ROEEngagement): Promise<void> {
  await ensureROEDir();
  const normalized: ROEEngagement = {
    ...engagement,
    missionPassphraseHash: engagementPassphraseHash(engagement) ?? "",
    missionPassphrase: undefined,
    updatedAt: new Date(),
  };
  const target = path.join(ROE_DIR, `${normalized.id}.json`);
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(normalized, null, 2), { encoding: "utf-8", mode: 0o600 });
  await fs.rename(temporary, target);
}

export async function loadEngagement(id: string): Promise<ROEEngagement | null> {
  if (!/^roe-[a-z0-9-]+$/i.test(id)) return null;
  try {
    const raw = await fs.readFile(path.join(ROE_DIR, `${id}.json`), "utf-8");
    const data = JSON.parse(raw) as ROEEngagement;
    data.validFrom = new Date(data.validFrom);
    data.validUntil = new Date(data.validUntil);
    data.createdAt = new Date(data.createdAt);
    data.updatedAt = new Date(data.updatedAt);
    data.auditLog = (data.auditLog ?? []).map((entry) => ({ ...entry, timestamp: new Date(entry.timestamp) }));
    data.missionPassphraseHash = engagementPassphraseHash(data) ?? "";
    data.missionPassphrase = undefined;
    return data;
  } catch {
    return null;
  }
}

export async function listEngagements(): Promise<ROEEngagement[]> {
  await ensureROEDir();
  const results: ROEEngagement[] = [];
  for (const file of (await fs.readdir(ROE_DIR)).filter((entry) => /^roe-[a-z0-9-]+\.json$/i.test(entry))) {
    const engagement = await loadEngagement(file.replace(/\.json$/, ""));
    if (engagement) results.push(engagement);
  }
  return results;
}

function zonedTimeParts(now: Date, timezone: string): { weekday: number; minutes: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday ?? "");
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  if (weekday < 0 || !Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error(`Unable to evaluate time window in timezone ${timezone}`);
  }
  return { weekday, minutes: hour * 60 + minute };
}

function parseClock(value: string): number {
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) throw new Error(`Invalid ROE clock value: ${value}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

function isWithinTimeWindow(windows: ROETimeWindow[], now = new Date()): boolean {
  if (windows.length === 0) return false;
  return windows.some((window) => {
    const { weekday, minutes } = zonedTimeParts(now, window.timezone);
    if (!window.daysOfWeek.includes(weekday)) return false;
    const start = parseClock(window.startTime);
    const end = parseClock(window.endTime);
    return start <= end ? minutes >= start && minutes <= end : minutes >= start || minutes <= end;
  });
}

function guidanceFor(engagement: ROEEngagement | null, missionType: string, target: string): MissionGuidance {
  const template = MISSION_GUIDANCE_TEMPLATES[missionType] ?? MISSION_GUIDANCE_TEMPLATES["full-ghost"]!;
  return {
    ...template,
    brief: engagement
      ? `Operate only under engagement ${engagement.id} for ${target}. Scope, authorization, time, test-identity, evidence, and stop controls are mandatory.`
      : "No valid ROE engagement was loaded. Mission is blocked.",
    hardLimits: engagement
      ? [...template.hardLimits, ...engagement.forbiddenTechniques.map((item) => `FORBIDDEN: ${item}`)]
      : template.hardLimits,
  };
}

function addCheck(
  checks: ROECheck[],
  violations: ROEViolation[],
  name: string,
  passed: boolean,
  detail: string,
  violation?: Omit<ROEViolation, "severity"> & { severity?: ROEViolation["severity"] },
): void {
  checks.push({ name, passed, detail });
  if (!passed && violation) violations.push({ severity: violation.severity ?? "blocking", ...violation });
}

export async function validateROE(
  engagementId: string,
  target: string,
  missionType: string,
  ghostMode: "passive" | "stealth" | "active",
  passphrase: string,
  operator: string,
): Promise<ROEValidationResult> {
  const now = new Date();
  const engagement = await loadEngagement(engagementId);
  const checks: ROECheck[] = [];
  const violations: ROEViolation[] = [];

  if (!engagement) {
    return {
      approved: false,
      engagementId,
      validatedAt: now,
      checks: [{ name: "Engagement Load", passed: false, detail: "No matching ROE engagement" }],
      violations: [{
        type: "missing-authorization",
        severity: "blocking",
        message: "No ROE engagement found",
        remediation: "Create and independently approve a signed engagement before testing",
      }],
      missionGuidance: guidanceFor(null, missionType, target),
      operatorBrief: "MISSION BLOCKED: no verifiable Rules of Engagement were loaded.",
    };
  }

  const statusOk = engagement.status === "approved" || engagement.status === "active";
  addCheck(checks, violations, "Engagement Status", statusOk, `Status: ${engagement.status}`, {
    type: "missing-authorization",
    message: `Engagement status ${engagement.status} does not permit testing`,
    remediation: "Obtain independent approval and set the engagement to approved or active",
  });

  const validityOk = now >= engagement.validFrom && now <= engagement.validUntil;
  addCheck(checks, violations, "Engagement Validity", validityOk, `${engagement.validFrom.toISOString()} to ${engagement.validUntil.toISOString()}`, {
    type: "expired-engagement",
    message: now > engagement.validUntil ? "Engagement has expired" : "Engagement has not started",
    remediation: "Use a currently valid signed authorization window",
  });

  const expectedHash = engagementPassphraseHash(engagement);
  const suppliedHash = passphraseHash(passphrase);
  const passphraseOk = Boolean(expectedHash && timingSafeHexEqual(expectedHash, suppliedHash));
  addCheck(checks, violations, "Mission Secret", passphraseOk, passphraseOk ? "Secret reference validated" : "Mission secret mismatch", {
    type: "operator-unverified",
    message: "Mission secret could not be verified",
    remediation: "Load the engagement secret from the approved secret manager",
  });

  const scopeDecision = evaluateTargetScope(target, engagement.scope);
  addCheck(checks, violations, "Target Scope", scopeDecision.allowed, scopeDecision.reason, {
    type: "out-of-scope-target",
    message: scopeDecision.reason,
    remediation: "Use an exact signed scope rule or execute a written scope amendment",
  });

  const missionOk = engagement.permittedMissionTypes.includes(missionType) || engagement.permittedMissionTypes.includes("full-ghost");
  addCheck(checks, violations, "Mission Type", missionOk, missionOk ? `${missionType} permitted` : `${missionType} not permitted`, {
    type: "unauthorized-technique",
    message: `Mission type ${missionType} is not authorized`,
    remediation: "Use a permitted mission type or obtain a signed amendment",
  });

  const modeOk = MODE_ORDER[ghostMode] <= MODE_ORDER[engagement.maxGhostMode];
  addCheck(checks, violations, "Ghost Mode", modeOk, `${ghostMode} requested; ${engagement.maxGhostMode} maximum`, {
    type: "unauthorized-technique",
    message: `Requested mode ${ghostMode} exceeds ${engagement.maxGhostMode}`,
    remediation: "Reduce mode or obtain a signed amendment",
  });

  let timeOk = false;
  try {
    timeOk = isWithinTimeWindow(engagement.timeWindows, now);
  } catch (error) {
    addCheck(checks, violations, "Time Window", false, error instanceof Error ? error.message : String(error), {
      type: "outside-time-window",
      message: "Testing window could not be validated",
      remediation: "Correct the IANA timezone and clock values in the signed ROE",
    });
  }
  if (!checks.some((check) => check.name === "Time Window")) {
    addCheck(checks, violations, "Time Window", timeOk, timeOk ? "Inside an approved window" : "Outside all approved windows", {
      type: "outside-time-window",
      message: "Current time is outside the authorized testing window",
      remediation: "Wait for the approved window or obtain a signed amendment",
    });
  }

  const operatorOk = engagement.operator.id === operator;
  addCheck(checks, violations, "Operator Identity", operatorOk, operatorOk ? `Operator ${operator} matched` : `Expected ${engagement.operator.id}`, {
    type: "operator-unverified",
    message: "Mission operator does not match the named ROE operator",
    remediation: "Use the named operator or execute an operator amendment",
  });

  const signature = engagement.legal.authorizationVerification;
  const signatureFresh = Boolean(
    signature?.status === "verified" &&
      (!signature.expiresAt || new Date(signature.expiresAt).getTime() >= now.getTime()),
  );
  const signatureRequired = ghostMode !== "passive";
  addCheck(
    checks,
    violations,
    "Authorization Signature",
    !signatureRequired || signatureFresh,
    signatureFresh ? `Verified by ${signature!.signerId} using ${signature!.keyId}` : signatureRequired ? "No current verified detached signature" : "Passive mode; signature verification recommended",
    signatureRequired
      ? {
          type: "missing-authorization",
          message: "Stealth and active testing require a current verified authorization-document signature",
          remediation: "Verify the detached signature against a trusted asset-owner or delegated-authorizer key",
        }
      : undefined,
  );

  const contactsOk = engagement.contacts.some((contact) => contact.role === "emergency") && engagement.contacts.some((contact) => contact.role === "technical");
  addCheck(checks, violations, "Emergency Contacts", contactsOk, contactsOk ? "Technical and emergency contacts present" : "Required contacts missing", {
    type: "missing-authorization",
    message: "Technical and emergency contacts are required",
    remediation: "Add named contacts and test the kill-switch process",
  });

  const blocking = violations.filter((violation) => violation.severity === "blocking");
  const approved = blocking.length === 0;
  const guidance = guidanceFor(engagement, missionType, target);
  const operatorBrief = [
    `NATT ROE ${approved ? "APPROVED" : "BLOCKED"}`,
    `Engagement: ${engagement.name} [${engagement.id}]`,
    `Client: ${engagement.client.name}`,
    `Operator: ${operator}`,
    `Target: ${target}`,
    `Mission: ${missionType}/${ghostMode}`,
    `Authorization signature: ${signatureFresh ? "verified" : "not verified"}`,
    ...(blocking.length ? blocking.map((violation) => `BLOCK: ${violation.message}`) : []),
  ].join("\n");

  engagement.auditLog.push({
    timestamp: now,
    event: approved ? "mission_authorized" : "mission_blocked",
    operator,
    target,
    detail: approved ? `${missionType}/${ghostMode} authorized` : blocking.map((item) => item.type).join(", "),
    severity: approved ? "info" : "violation",
  });
  await saveEngagement(engagement);

  return {
    approved,
    engagementId,
    validatedAt: now,
    checks,
    violations,
    missionGuidance: guidance,
    operatorBrief,
  };
}

export async function createROEEngagement(params: {
  name: string;
  scope: ROEScope;
  client: ROEEngagement["client"];
  operator: ROEEngagement["operator"];
  legal?: Partial<ROEEngagement["legal"]>;
  timeWindows?: ROETimeWindow[];
  contacts?: ROEContact[];
  forbiddenTechniques?: string[];
  permittedMissionTypes?: string[];
  maxGhostMode?: ROEEngagement["maxGhostMode"];
  validDays?: number;
  classification?: ROEClassification;
  missionPassphrase?: string;
  status?: ROEStatus;
}): Promise<ROEEngagement> {
  const now = new Date();
  const passphrase = params.missionPassphrase ?? crypto.randomBytes(32).toString("base64url");
  const engagement: ROEEngagement = {
    id: `roe-${crypto.randomUUID().slice(0, 8)}`,
    name: params.name,
    classification: params.classification ?? "confidential",
    status: params.status ?? "pending-approval",
    operator: params.operator,
    client: params.client,
    legal: {
      jurisdiction: "United States",
      contractRef: "UNASSIGNED",
      ...params.legal,
    },
    scope: params.scope,
    timeWindows: params.timeWindows ?? [],
    contacts: params.contacts ?? [],
    forbiddenTechniques: params.forbiddenTechniques ?? [
      "Denial of Service",
      "Destructive action",
      "Real-data exfiltration",
      "Production credential capture",
      "Autonomous scope expansion",
    ],
    permittedMissionTypes: params.permittedMissionTypes ?? [],
    maxGhostMode: params.maxGhostMode ?? "passive",
    validFrom: now,
    validUntil: new Date(now.getTime() + (params.validDays ?? 30) * 86_400_000),
    missionPassphraseHash: passphraseHash(passphrase),
    createdAt: now,
    updatedAt: now,
    auditLog: [{
      timestamp: now,
      event: "engagement_created",
      operator: params.operator.id,
      detail: `Engagement ${params.name} created in ${params.status ?? "pending-approval"} status`,
      severity: "info",
    }],
  };
  await saveEngagement(engagement);
  return engagement;
}

export async function getOrCreateDefaultEngagement(operator = "local-dev"): Promise<ROEEngagement> {
  const existing = (await listEngagements()).find(
    (engagement) => engagement.name === "NATT Isolated Lab Engagement" && engagement.operator.id === operator,
  );
  if (existing) return existing;

  return createROEEngagement({
    name: "NATT Isolated Lab Engagement",
    status: "approved",
    scope: {
      inScope: ["localhost", "127.0.0.1", "::1", "*.test"],
      outOfScope: [],
      includeSubdomains: false,
    },
    client: {
      name: "DevBot Isolated Lab",
      contactEmail: "security@devbot.invalid",
      authorizingOfficer: "Local Lab Owner",
    },
    operator: {
      id: operator,
      name: "NATT Lab Operator",
      organization: "DevBot Security Lab",
      credential: "local-lab",
    },
    timeWindows: [{
      startTime: "00:00",
      endTime: "23:59",
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      timezone: "UTC",
    }],
    contacts: [
      { role: "technical", name: "Local Operator", email: "security@devbot.invalid", responseTimeMins: 5 },
      { role: "emergency", name: "Local Operator", email: "security@devbot.invalid", responseTimeMins: 5 },
    ],
    permittedMissionTypes: ["web-app", "html-analysis", "api-recon", "network-recon", "auth-testing", "code-analysis"],
    maxGhostMode: "active",
    missionPassphrase: process.env.NATT_LOCAL_LAB_PASSPHRASE ?? crypto.randomBytes(32).toString("base64url"),
    validDays: 1,
  });
}

export function checkPhaseROE(
  engagement: ROEEngagement,
  phase: string,
  technique: string,
  target: string,
): PhaseROEGate {
  if (!(engagement.status === "approved" || engagement.status === "active")) {
    return { phase, target, technique, approved: false, reason: `Engagement status ${engagement.status} blocks testing` };
  }
  if (new Date() < engagement.validFrom || new Date() > engagement.validUntil) {
    return { phase, target, technique, approved: false, reason: "Engagement validity window is not current" };
  }
  const scope = evaluateTargetScope(target, engagement.scope);
  if (!scope.allowed) return { phase, target, technique, approved: false, reason: scope.reason };
  const forbidden = engagement.forbiddenTechniques.some((item) =>
    technique.toLowerCase().includes(item.toLowerCase()) || item.toLowerCase().includes(technique.toLowerCase()),
  );
  if (forbidden) {
    return { phase, target, technique, approved: false, reason: `Technique ${technique} is forbidden by the signed ROE` };
  }
  return { phase, target, technique, approved: true, reason: `Phase ${phase} is inside current scope and technique controls` };
}
