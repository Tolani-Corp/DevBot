import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { evaluateTargetScope, type NetworkScopePolicy } from "../security/network-scope.js";
import { evaluatePathfinderGate } from "../security/pathfinder-gate.js";

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
  /** SHA-256 hash only. Plaintext passphrases are never persisted. */
  missionPassphraseHash: string;
  /** Legacy input accepted only for migration; removed whenever the record is saved. */
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

const ROE_DIR = path.resolve(process.env.NATT_ROE_DIR?.trim() || path.join(process.cwd(), ".natt", "roe"));
const MODE_ORDER: Record<"passive" | "stealth" | "active", number> = {
  passive: 0,
  stealth: 1,
  active: 2,
};

const NON_OVERRIDABLE = new Set<ROEViolationType>([
  "banned-target",
  "jurisdiction-mismatch",
  "destructive-action-blocked",
  "concurrent-mission-limit",
]);

const ROE_BYPASS_TYPES = new Set<ROEViolationType>([
  "unauthorized-technique",
  "outside-time-window",
  "missing-authorization",
  "expired-engagement",
  "operator-unverified",
]);

function missionGuidance(
  engagement: ROEEngagement | null,
  missionType: string,
  target: string,
  pathfinderNotes: string[] = [],
): MissionGuidance {
  return {
    brief: engagement
      ? `Operate only for engagement ${engagement.id}, target ${target}, and mission ${missionType}. ${pathfinderNotes.join(" ")}`.trim()
      : "No verifiable engagement was loaded; mission is blocked.",
    objectives: [
      "Validate approved security controls",
      "Capture sanitized and reproducible evidence",
      "Produce remediation and retest guidance",
    ],
    hardLimits: [
      "No destructive action or denial of service",
      "No production credential capture or real-data exfiltration",
      "No persistence or autonomous target expansion",
      "Stop on instability, unexpected personal data, or third-party infrastructure",
      "Pathfinder never overrides production, destructive-action, restricted-target, or emergency-stop controls",
      ...(engagement?.forbiddenTechniques.map((item) => `FORBIDDEN: ${item}`) ?? []),
    ],
    escalationTriggers: [
      "Critical uncontrolled access",
      "Unexpected production-user or cross-tenant data",
      "System instability or availability impact",
      "Evidence of an active third-party intrusion",
    ],
    approvedTechniques: [
      "Only the techniques permitted by the signed request, engagement, and active break-glass capability",
    ],
    breakGlassProtocol:
      "Stop the isolated child process, preserve the append-only audit record, contact the named emergency owner, and require a new challenge for any restart.",
    evidenceRequirements: [
      "Exact request, engagement, target, and timestamp",
      "Sanitized finding evidence",
      "Authorization and break-glass verification digests",
      "Operator, approver, and access-method audit records",
    ],
  };
}

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
  await fs.writeFile(temporary, JSON.stringify(normalized, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  await fs.rename(temporary, target);
}

export async function loadEngagement(id: string): Promise<ROEEngagement | null> {
  if (!/^roe-[a-z0-9-]+$/i.test(id)) return null;
  try {
    const raw = await fs.readFile(path.join(ROE_DIR, `${id}.json`), "utf8");
    const data = JSON.parse(raw) as ROEEngagement;
    data.validFrom = new Date(data.validFrom);
    data.validUntil = new Date(data.validUntil);
    data.createdAt = new Date(data.createdAt);
    data.updatedAt = new Date(data.updatedAt);
    data.auditLog = (data.auditLog ?? []).map((entry) => ({
      ...entry,
      timestamp: new Date(entry.timestamp),
    }));
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

function addCheck(
  checks: ROECheck[],
  violations: ROEViolation[],
  name: string,
  passed: boolean,
  detail: string,
  violation?: Omit<ROEViolation, "severity"> & { severity?: ROEViolation["severity"] },
): void {
  checks.push({ name, passed, detail });
  if (!passed && violation) {
    violations.push({ severity: violation.severity ?? "blocking", ...violation });
  }
}

async function applyPathfinderOverrides(input: {
  engagement: ROEEngagement;
  target: string;
  missionType: string;
  ghostMode: "passive" | "stealth" | "active";
  checks: ROECheck[];
  violations: ROEViolation[];
}): Promise<string[]> {
  const requestId = process.env.NATT_PATHFINDER_REQUEST_ID?.trim();
  if (!requestId || process.env.NATT_PATHFINDER !== "true") return [];

  const notes: string[] = [];
  const context = {
    requestId,
    engagementId: input.engagement.id,
    target: input.target,
    missionType: input.missionType,
    ghostMode: input.ghostMode,
  };

  if (input.violations.some((violation) => violation.severity === "blocking" && violation.type === "out-of-scope-target")) {
    const scopeOverride = await evaluatePathfinderGate(
      { ...context, requiredCapability: "scope-override" },
      { activate: true },
    );
    input.checks.push({
      name: "Pathfinder Scope Override",
      passed: scopeOverride.authorized,
      detail: scopeOverride.reason,
    });
    if (scopeOverride.authorized) {
      for (const violation of input.violations) {
        if (violation.type === "out-of-scope-target") {
          violation.severity = "warning";
          violation.remediation = `Break-glass scope override ${scopeOverride.manifest?.overrideId} applied for this exact request and target`;
        }
      }
      notes.push(`Scope override ${scopeOverride.manifest?.overrideId} authenticated by ${scopeOverride.manifest?.access.method}.`);
    }
  }

  const overrideCandidates = input.violations.filter(
    (violation) =>
      violation.severity === "blocking" &&
      ROE_BYPASS_TYPES.has(violation.type) &&
      !NON_OVERRIDABLE.has(violation.type),
  );
  if (overrideCandidates.length > 0) {
    const roeOverride = await evaluatePathfinderGate(
      { ...context, requiredCapability: "roe-bypass" },
      { activate: true },
    );
    input.checks.push({
      name: "Pathfinder ROE Override",
      passed: roeOverride.authorized,
      detail: roeOverride.reason,
    });
    if (roeOverride.authorized) {
      for (const violation of overrideCandidates) {
        violation.severity = "warning";
        violation.remediation = `Break-glass ROE override ${roeOverride.manifest?.overrideId} applied for this exact request and target`;
      }
      notes.push(`ROE override ${roeOverride.manifest?.overrideId} authenticated by ${roeOverride.manifest?.access.method}.`);
    }
  }

  return notes;
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
        remediation: "Create and independently approve an engagement before testing",
      }],
      missionGuidance: missionGuidance(null, missionType, target),
      operatorBrief: "MISSION BLOCKED: no verifiable Rules of Engagement were loaded.",
    };
  }

  const statusOk = engagement.status === "approved" || engagement.status === "active";
  addCheck(checks, violations, "Engagement Status", statusOk, `Status: ${engagement.status}`, {
    type: "missing-authorization",
    message: `Engagement status ${engagement.status} does not permit testing`,
    remediation: "Obtain approval or a fresh break-glass challenge",
  });

  const validityOk = now >= engagement.validFrom && now <= engagement.validUntil;
  addCheck(
    checks,
    violations,
    "Engagement Validity",
    validityOk,
    `${engagement.validFrom.toISOString()} to ${engagement.validUntil.toISOString()}`,
    {
      type: "expired-engagement",
      message: now > engagement.validUntil ? "Engagement has expired" : "Engagement has not started",
      remediation: "Use a current authorization window or a fresh break-glass challenge",
    },
  );

  const expectedHash = engagementPassphraseHash(engagement);
  const suppliedHash = passphraseHash(passphrase);
  const passphraseOk = Boolean(expectedHash && timingSafeHexEqual(expectedHash, suppliedHash));
  addCheck(checks, violations, "Mission Secret", passphraseOk, passphraseOk ? "Secret reference validated" : "Mission secret mismatch", {
    type: "operator-unverified",
    message: "Mission secret could not be verified",
    remediation: "Load the engagement secret from the approved secret manager or complete a fresh break-glass challenge",
  });

  const scopeDecision = evaluateTargetScope(target, engagement.scope);
  addCheck(checks, violations, "Target Scope", scopeDecision.allowed, scopeDecision.reason, {
    type: "out-of-scope-target",
    message: scopeDecision.reason,
    remediation: "Use signed scope or obtain a passkey/code-authenticated scope override",
  });

  const missionOk =
    engagement.permittedMissionTypes.includes(missionType) ||
    engagement.permittedMissionTypes.includes("full-ghost");
  addCheck(checks, violations, "Mission Type", missionOk, missionOk ? `${missionType} permitted` : `${missionType} not permitted`, {
    type: "unauthorized-technique",
    message: `Mission type ${missionType} is not authorized`,
    remediation: "Use a permitted mission or obtain a fresh break-glass challenge",
  });

  const modeOk = MODE_ORDER[ghostMode] <= MODE_ORDER[engagement.maxGhostMode];
  addCheck(checks, violations, "Ghost Mode", modeOk, `${ghostMode} requested; ${engagement.maxGhostMode} maximum`, {
    type: "unauthorized-technique",
    message: `Requested mode ${ghostMode} exceeds ${engagement.maxGhostMode}`,
    remediation: "Reduce mode or obtain a fresh break-glass challenge",
  });

  let timeOk = false;
  try {
    timeOk = isWithinTimeWindow(engagement.timeWindows, now);
  } catch (error) {
    addCheck(checks, violations, "Time Window", false, error instanceof Error ? error.message : String(error), {
      type: "outside-time-window",
      message: "Testing window could not be validated",
      remediation: "Correct the signed window or obtain a fresh break-glass challenge",
    });
  }
  if (!checks.some((check) => check.name === "Time Window")) {
    addCheck(checks, violations, "Time Window", timeOk, timeOk ? "Inside an approved window" : "Outside all approved windows", {
      type: "outside-time-window",
      message: "Current time is outside the authorized testing window",
      remediation: "Wait for the window or obtain a fresh break-glass challenge",
    });
  }

  const operatorOk = engagement.operator.id === operator;
  addCheck(checks, violations, "Operator Identity", operatorOk, operatorOk ? `Operator ${operator} matched` : `Expected ${engagement.operator.id}`, {
    type: "operator-unverified",
    message: "Mission operator does not match the named ROE operator",
    remediation: "Use the named operator or authenticate a fresh break-glass challenge",
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
    signatureFresh
      ? `Verified by ${signature!.signerId} using ${signature!.keyId}`
      : signatureRequired
        ? "No current verified detached signature"
        : "Passive mode; signature verification recommended",
    signatureRequired
      ? {
          type: "missing-authorization",
          message: "Stealth and active testing require a current authorization-document signature",
          remediation: "Verify the client signature or authenticate a fresh break-glass challenge",
        }
      : undefined,
  );

  const contactsOk =
    engagement.contacts.some((contact) => contact.role === "emergency") &&
    engagement.contacts.some((contact) => contact.role === "technical");
  addCheck(checks, violations, "Emergency Contacts", contactsOk, contactsOk ? "Required contacts present" : "Required contacts missing", {
    type: "missing-authorization",
    message: "Technical and emergency contacts are required",
    remediation: "Add named contacts; this control is reviewed before every execution",
  });

  const pathfinderNotes = await applyPathfinderOverrides({
    engagement,
    target,
    missionType,
    ghostMode,
    checks,
    violations,
  });
  const blocking = violations.filter((violation) => violation.severity === "blocking");
  const approved = blocking.length === 0;
  const guidance = missionGuidance(engagement, missionType, target, pathfinderNotes);
  const operatorBrief = [
    `NATT ROE ${approved ? "APPROVED" : "BLOCKED"}`,
    `Engagement: ${engagement.name} [${engagement.id}]`,
    `Client: ${engagement.client.name}`,
    `Operator: ${operator}`,
    `Target: ${target}`,
    `Mission: ${missionType}/${ghostMode}`,
    `Authorization signature: ${signatureFresh ? "verified" : "not verified"}`,
    ...pathfinderNotes.map((note) => `BREAK-GLASS: ${note}`),
    ...blocking.map((violation) => `BLOCK: ${violation.message}`),
  ].join("\n");

  engagement.auditLog.push({
    timestamp: now,
    event: approved
      ? pathfinderNotes.length > 0
        ? "mission_authorized_break_glass"
        : "mission_authorized"
      : "mission_blocked",
    operator,
    target,
    detail: approved
      ? `${missionType}/${ghostMode} authorized${pathfinderNotes.length ? `; ${pathfinderNotes.join(" ")}` : ""}`
      : blocking.map((item) => item.type).join(", "),
    severity: pathfinderNotes.length > 0 ? "warning" : approved ? "info" : "violation",
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
    permittedMissionTypes: [
      "web-app",
      "html-analysis",
      "api-recon",
      "network-recon",
      "auth-testing",
      "code-analysis",
    ],
    maxGhostMode: "active",
    missionPassphrase: process.env.NATT_LOCAL_LAB_PASSPHRASE ?? crypto.randomBytes(32).toString("base64url"),
    validDays: 1,
  });
}

/**
 * Per-phase gate remains strict and synchronous. Break-glass authorization is
 * evaluated only once through validateROE before the isolated mission starts;
 * forbidden techniques are never overridden at phase level.
 */
export function checkPhaseROE(
  engagement: ROEEngagement,
  phase: string,
  technique: string,
  target: string,
): PhaseROEGate {
  if (!(engagement.status === "approved" || engagement.status === "active")) {
    return {
      phase,
      target,
      technique,
      approved: false,
      reason: `Engagement status ${engagement.status} blocks testing`,
    };
  }
  if (new Date() < engagement.validFrom || new Date() > engagement.validUntil) {
    return {
      phase,
      target,
      technique,
      approved: false,
      reason: "Engagement validity window is not current",
    };
  }
  const scope = evaluateTargetScope(target, engagement.scope);
  if (!scope.allowed) return { phase, target, technique, approved: false, reason: scope.reason };
  const forbidden = engagement.forbiddenTechniques.some(
    (item) =>
      technique.toLowerCase().includes(item.toLowerCase()) ||
      item.toLowerCase().includes(technique.toLowerCase()),
  );
  if (forbidden) {
    return {
      phase,
      target,
      technique,
      approved: false,
      reason: `Technique ${technique} is forbidden by the signed ROE`,
    };
  }
  return {
    phase,
    target,
    technique,
    approved: true,
    reason: `Phase ${phase} is inside current scope and technique controls`,
  };
}
