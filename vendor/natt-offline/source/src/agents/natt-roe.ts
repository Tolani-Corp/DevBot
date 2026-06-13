/**
 * natt-roe.ts — NATT Rules of Engagement Engine
 *
 * Network Attack & Testing Toolkit
 * Rules of Engagement (ROE) validator for every NATT mission.
 *
 * ── PATHFINDER MODE ──────────────────────────────────────────────────────────
 * Set NATT_PATHFINDER=true in the environment to bypass ALL ROE gates.
 * This is the founder / operator copy — unrestricted. Marketing editions
 * ship with full ROE enforcement; users may adjust post-purchase.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ROE covers:
 *  • Scope definition      — what is in-scope vs out-of-scope
 *  • Authorization proof   — written consent for active testing
 *  • Time windows          — allowed test hours (maintenance windows)
 *  • Excluded techniques   — DoS, destructive tests, data exfil
 *  • Contact / escalation  — who to call if something breaks
 *  • Legal jurisdiction    — governing law for the engagement
 *  • Mission classification — confidentiality level
 *  • Operator identity     — verified tester credentials
 *
 * ROE is validated at engagement creation AND before each sub-phase.
 * Any ROE violation aborts the mission and generates an audit record.
 */

import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

// ─────────────────────────────────────────────────────────────────────────────
//  ROE Types
// ─────────────────────────────────────────────────────────────────────────────

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

export interface ROEScope {
  /** Explicitly in-scope targets (URLs, IPs, CIDR, domains). */
  inScope: string[];
  /** Explicitly out-of-scope targets. */
  outOfScope: string[];
  /** In-scope ports (empty = all allowed). */
  allowedPorts?: number[];
  /** In-scope paths/endpoints. */
  allowedPaths?: string[];
  /** Whether subdomains of in-scope domains are automatically in-scope. */
  includeSubdomains: boolean;
}

export interface ROETimeWindow {
  /** ISO 8601 start time, e.g. "09:00" */
  startTime: string;
  /** ISO 8601 end time, e.g. "17:00" */
  endTime: string;
  /** Days of week: 0=Sun, 1=Mon, ..., 6=Sat */
  daysOfWeek: number[];
  /** IANA timezone, e.g. "America/New_York" */
  timezone: string;
}

export interface ROEContact {
  role: "primary" | "technical" | "emergency" | "legal";
  name: string;
  email: string;
  phone?: string;
  /** Response time SLA in minutes. */
  responseTimeMins: number;
}

export interface ROEEngagement {
  /** Unique engagement ID. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Classification level — governs handling and distribution. */
  classification: ROEClassification;
  /** Current status of the engagement. */
  status: ROEStatus;
  /** Operator/tester identity. */
  operator: {
    id: string;
    name: string;
    /** Organization or firm conducting the test. */
    organization: string;
    /** Digital signature / credential reference. */
    credential: string;
  };
  /** Client / target organization. */
  client: {
    name: string;
    contactEmail: string;
    /** Authorizing officer (who signed off). */
    authorizingOfficer: string;
  };
  /** Legal and jurisdictional info. */
  legal: {
    /** Governing law jurisdiction. */
    jurisdiction: string;
    /** Contract / SOW reference. */
    contractRef: string;
    /** Authorization document hash (SHA-256 of signed document). */
    authDocHash?: string;
  };
  /** What's in/out of scope. */
  scope: ROEScope;
  /** When testing is permitted. */
  timeWindows: ROETimeWindow[];
  /** Emergency contacts. */
  contacts: ROEContact[];
  /** Techniques explicitly forbidden for this engagement. */
  forbiddenTechniques: string[];
  /** Mission types permitted for this engagement. */
  permittedMissionTypes: string[];
  /** Max ghost mode level permitted. */
  maxGhostMode: "passive" | "stealth" | "active";
  /** Engagement validity window. */
  validFrom: Date;
  validUntil: Date;
  /** Unique passphrase that must be provided at mission start. */
  missionPassphrase: string;
  /** SHA-256 hash of the authorization document content. */
  createdAt: Date;
  updatedAt: Date;
  /** Audit log of all ROE events. */
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
  /** Pre-mission operator briefing. */
  brief: string;
  /** Objectives for this mission. */
  objectives: string[];
  /** Hard limits — STOP if these are encountered. */
  hardLimits: string[];
  /** Escalation triggers — when to call the emergency contact. */
  escalationTriggers: string[];
  /** Approved techniques for this mission type. */
  approvedTechniques: string[];
  /** What to do if something breaks. */
  breakGlassProtocol: string;
  /** Evidence collection requirements. */
  evidenceRequirements: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
//  Mission Guidance Templates by Mission Type
// ─────────────────────────────────────────────────────────────────────────────

const MISSION_GUIDANCE_TEMPLATES: Record<string, Omit<MissionGuidance, "brief">> = {
  "web-app": {
    objectives: [
      "Enumerate all entry points (forms, parameters, headers, cookies)",
      "Test for OWASP Top 10 vulnerabilities",
      "Assess authentication and session management",
      "Review client-side security (CSP, SRI, mixed content)",
      "Identify information disclosure in responses and error messages",
    ],
    hardLimits: [
      "DO NOT submit forms that trigger financial transactions",
      "DO NOT delete, modify, or exfiltrate real user data",
      "DO NOT trigger alerts/notifications to end users",
      "STOP if you encounter live production data unrelated to the test account",
    ],
    escalationTriggers: [
      "Discovery of credentials for accounts not provisioned for testing",
      "Access to data classified above the engagement classification level",
      "Evidence that another party is actively attacking the target",
      "System instability caused by testing",
    ],
    approvedTechniques: [
      "Passive crawling and spidering",
      "Header analysis",
      "Input validation testing (with test payloads only)",
      "Authentication bypass testing",
      "Session token analysis",
      "Directory/file enumeration",
    ],
    breakGlassProtocol:
      "Immediately cease all testing. Capture current state. Contact primary contact within 15 minutes. Do not destroy evidence.",
    evidenceRequirements: [
      "Screenshot of all findings with timestamp",
      "HTTP request/response pairs for each finding",
      "Proof-of-concept reproduction steps",
      "CVSS score with justification",
    ],
  },
  "api-recon": {
    objectives: [
      "Discover all API endpoints (documented and undocumented)",
      "Test authentication mechanisms (API keys, JWT, OAuth)",
      "Check for IDOR across resource endpoints",
      "Test rate limiting and anti-automation controls",
      "Identify sensitive data exposure in responses",
    ],
    hardLimits: [
      "DO NOT call endpoints that trigger irreversible actions (delete, charge, send)",
      "DO NOT attempt to access other tenants' data",
      "Rate limit your requests to avoid DoS — max 10 req/sec",
      "STOP if you obtain tokens/credentials not provisioned for testing",
    ],
    escalationTriggers: [
      "Discovery of unauthenticated admin API endpoints",
      "BOLA/IDOR with access to real user data",
      "API key exposure in public responses",
    ],
    approvedTechniques: [
      "OpenAPI/Swagger enumeration",
      "HTTP method fuzzing (OPTIONS, HEAD, TRACE)",
      "Parameter pollution testing",
      "JWT algorithm confusion testing",
      "BOLA/IDOR enumeration with test accounts",
    ],
    breakGlassProtocol:
      "Stop all requests immediately. Record last 10 requests and responses. Contact technical contact.",
    evidenceRequirements: [
      "Complete API endpoint list discovered",
      "Auth bypass proof with redacted response",
      "Token samples (redacted to first 8 chars)",
    ],
  },
  "network-recon": {
    objectives: [
      "Map all live hosts in scope",
      "Identify open ports and running services",
      "Fingerprint OS and service versions",
      "Assess SSL/TLS posture",
      "Identify misconfigured network services",
    ],
    hardLimits: [
      "DO NOT run denial-of-service or flood scans",
      "DO NOT scan out-of-scope CIDR ranges",
      "Use timing -T3 or lower to avoid impacting production",
      "DO NOT attempt to exploit any discovered vulnerabilities without explicit approval",
    ],
    escalationTriggers: [
      "Discovery of industrial control systems (ICS/SCADA)",
      "Evidence of known-exploited CVEs on production systems",
      "Discovery of end-of-life operating systems",
    ],
    approvedTechniques: [
      "SYN scan (nmap -sS)",
      "Service version detection (nmap -sV)",
      "OS fingerprinting (nmap -O)",
      "SSL/TLS scanning (sslyze, testssl.sh)",
      "Banner grabbing",
    ],
    breakGlassProtocol:
      "Stop all scanning. If scan impact is suspected, contact emergency contact immediately.",
    evidenceRequirements: [
      "Full nmap scan output",
      "SSL/TLS assessment report",
      "List of services with versions and known CVEs",
    ],
  },
  "osint": {
    objectives: [
      "Map the organization's digital footprint",
      "Discover subdomains, ASN ranges, email patterns",
      "Identify exposed credentials or sensitive data",
      "Enumerate employee/executive information from public sources",
      "Map third-party relationships and supply chain exposure",
    ],
    hardLimits: [
      "Passive sources only — do not contact individuals",
      "Do not create fake accounts or use deceptive identities",
      "Do not access non-public sites (requires login)",
      "Record all sources for evidence chain",
    ],
    escalationTriggers: [
      "Discovery of leaked credentials for in-scope accounts",
      "Evidence of active phishing targeting the client",
      "Exposed PII datasets",
    ],
    approvedTechniques: [
      "Public search engines (Google, Bing, Shodan)",
      "Certificate Transparency logs",
      "WHOIS and DNS enumeration",
      "GitHub/GitLab public repo scanning",
      "LinkedIn/professional network profiling (read-only)",
      "Wayback Machine / web archive analysis",
      "Paste site monitoring",
    ],
    breakGlassProtocol:
      "Cease collection. If active threat discovered, escalate to emergency contact within 30 minutes.",
    evidenceRequirements: [
      "Source URLs for all findings",
      "Timestamps of discovery",
      "Data classification for each item found",
    ],
  },
  "auth-testing": {
    objectives: [
      "Assess password policy strength",
      "Test for account enumeration via timing attacks and error messages",
      "Validate MFA implementation",
      "Test session management (fixation, hijacking, expiry)",
      "Assess OAuth/OIDC implementation",
    ],
    hardLimits: [
      "DO NOT lock production accounts — use test credentials only",
      "Rate limit brute force to max 5 attempts before backing off",
      "DO NOT capture or store real user credentials",
      "Test JWT with provided signature secrets only",
    ],
    escalationTriggers: [
      "Discovery of hardcoded admin credentials",
      "Authentication bypass affecting all users",
      "Session tokens with no expiry",
    ],
    approvedTechniques: [
      "Username enumeration via response timing/message",
      "Password spray with 3 attempts max",
      "JWT none algorithm test",
      "JWT algorithm confusion (RS256→HS256)",
      "OAuth PKCE bypass testing",
      "Session fixation testing",
    ],
    breakGlassProtocol:
      "Stop all auth tests. Document last performed action. Contact technical contact.",
    evidenceRequirements: [
      "Auth bypass proof with test account only",
      "HTTP request proving the vulnerability",
      "No real user credentials in evidence",
    ],
  },
  "full-ghost": {
    objectives: [
      "Comprehensive security assessment across all attack surfaces",
      "Identify the highest-risk attack chains",
      "Validate defense-in-depth posture",
      "Produce prioritized remediation roadmap",
    ],
    hardLimits: [
      "All technique-specific hard limits apply",
      "DO NOT move laterally beyond initial target scope",
      "DO NOT exfiltrate real data — only metadata and hashes as proof",
      "STOP at first critical finding and notify primary contact",
    ],
    escalationTriggers: [
      "Any critical severity finding",
      "Evidence of existing breach or active attacker",
      "System instability",
      "Scope creep detected",
    ],
    approvedTechniques: [
      "All passive and stealth techniques from mission-specific templates",
      "Active testing only with explicit active-mode authorization",
    ],
    breakGlassProtocol:
      "Full stop. Emergency call to all contacts. Preserve all evidence. Await instructions.",
    evidenceRequirements: [
      "All findings with full reproduction steps",
      "Attack chain diagrams for critical/high findings",
      "Executive summary with risk scoring",
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  ROE Store (filesystem-backed)
// ─────────────────────────────────────────────────────────────────────────────

const ROE_DIR = path.join(process.cwd(), ".natt", "roe");

async function ensureROEDir(): Promise<void> {
  await fs.mkdir(ROE_DIR, { recursive: true });
}

export async function saveEngagement(engagement: ROEEngagement): Promise<void> {
  await ensureROEDir();
  const filePath = path.join(ROE_DIR, `${engagement.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(engagement, null, 2), "utf-8");
}

export async function loadEngagement(id: string): Promise<ROEEngagement | null> {
  try {
    const filePath = path.join(ROE_DIR, `${id}.json`);
    const raw = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(raw) as ROEEngagement;
    // Rehydrate dates
    data.validFrom = new Date(data.validFrom);
    data.validUntil = new Date(data.validUntil);
    data.createdAt = new Date(data.createdAt);
    data.updatedAt = new Date(data.updatedAt);
    data.auditLog = data.auditLog.map((e) => ({ ...e, timestamp: new Date(e.timestamp) }));
    return data;
  } catch {
    return null;
  }
}

export async function listEngagements(): Promise<ROEEngagement[]> {
  await ensureROEDir();
  try {
    const files = await fs.readdir(ROE_DIR);
    const engagements: ROEEngagement[] = [];
    for (const file of files.filter((f) => f.endsWith(".json"))) {
      const id = file.replace(".json", "");
      const e = await loadEngagement(id);
      if (e) engagements.push(e);
    }
    return engagements;
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Scope Check
// ─────────────────────────────────────────────────────────────────────────────

function normalizeHost(value: string): string {
  try {
    if (value.startsWith("http")) return new URL(value).hostname.toLowerCase();
  } catch {}
  return value.toLowerCase().trim();
}

function isInScope(target: string, scope: ROEScope): boolean {
  const host = normalizeHost(target);

  // Check explicitly out-of-scope first
  for (const outTarget of scope.outOfScope) {
    const outHost = normalizeHost(outTarget);
    if (host === outHost || host.endsWith(`.${outHost}`)) return false;
  }

  // Check in-scope
  for (const inTarget of scope.inScope) {
    const inHost = normalizeHost(inTarget);

    // Exact match
    if (host === inHost) return true;

    // CIDR match (basic)
    if (inTarget.includes("/")) {
      // IPv4 CIDR check - simplified
      const [cidrBase] = inTarget.split("/");
      if (cidrBase && host.startsWith(cidrBase.split(".").slice(0, 3).join("."))) return true;
    }

    // Subdomain match if enabled
    if (scope.includeSubdomains && host.endsWith(`.${inHost}`)) return true;

    // Wildcard
    if (inTarget.startsWith("*.") && host.endsWith(inTarget.slice(1))) return true;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Time Window Check
// ─────────────────────────────────────────────────────────────────────────────

function isWithinTimeWindow(windows: ROETimeWindow[]): boolean {
  if (windows.length === 0) return true; // No restriction = always allowed

  const now = new Date();
  const dayOfWeek = now.getDay();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const currentMins = currentHour * 60 + currentMin;

  for (const window of windows) {
    if (!window.daysOfWeek.includes(dayOfWeek)) continue;

    const [startH, startM] = window.startTime.split(":").map(Number);
    const [endH, endM] = window.endTime.split(":").map(Number);
    const startMins = (startH ?? 0) * 60 + (startM ?? 0);
    const endMins = (endH ?? 0) * 60 + (endM ?? 0);

    if (currentMins >= startMins && currentMins <= endMins) return true;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Core ROE Validator
// ─────────────────────────────────────────────────────────────────────────────

export async function validateROE(
  engagementId: string,
  target: string,
  missionType: string,
  ghostMode: "passive" | "stealth" | "active",
  passphrase: string,
  operator: string
): Promise<ROEValidationResult> {
  // ── PATHFINDER MODE: bypass all ROE gates ──────────────────
  if (process.env.NATT_PATHFINDER === "true") {
    return {
      approved: true,
      engagementId,
      validatedAt: new Date(),
      checks: [{ name: "PATHFINDER", passed: true, detail: "All gates bypassed — NATT Pathfinder mode active" }],
      violations: [],
      missionGuidance: buildDefaultGuidance(missionType),
      operatorBrief: `PATHFINDER: ${missionType}/${ghostMode} on ${target} — fully authorized. No ROE restrictions.`,
    };
  }

  const engagement = await loadEngagement(engagementId);
  const checks: ROECheck[] = [];
  const violations: ROEViolation[] = [];
  const now = new Date();

  // ── Check 1: Engagement exists and is loaded ───────────────
  if (!engagement) {
    return {
      approved: false,
      engagementId,
      validatedAt: now,
      checks: [{ name: "Engagement Load", passed: false, detail: "No engagement found with this ID" }],
      violations: [{
        type: "missing-authorization",
        severity: "blocking",
        message: "No ROE engagement found",
        remediation: "Create an engagement with createROEEngagement() before launching missions",
      }],
      missionGuidance: buildDefaultGuidance(missionType),
      operatorBrief: "MISSION BLOCKED: No Rules of Engagement found. Create an engagement first.",
    };
  }

  // ── Check 2: Engagement status ─────────────────────────────
  const statusOk = engagement.status === "approved" || engagement.status === "active";
  checks.push({
    name: "Engagement Status",
    passed: statusOk,
    detail: `Status: ${engagement.status}`,
  });
  if (!statusOk) {
    violations.push({
      type: "missing-authorization",
      severity: "blocking",
      message: `Engagement status is "${engagement.status}" — must be "approved" or "active"`,
      remediation: "Set engagement status to 'approved' before starting missions",
    });
  }

  // ── Check 3: Engagement validity window ────────────────────
  const validityOk = now >= engagement.validFrom && now <= engagement.validUntil;
  checks.push({
    name: "Engagement Validity",
    passed: validityOk,
    detail: `Valid from ${engagement.validFrom.toISOString()} to ${engagement.validUntil.toISOString()}`,
  });
  if (!validityOk) {
    violations.push({
      type: "expired-engagement",
      severity: "blocking",
      message: now > engagement.validUntil
        ? "Engagement has expired"
        : "Engagement has not started yet",
      remediation: "Renew engagement authorization or adjust validity window",
    });
  }

  // ── Check 4: Passphrase verification ───────────────────────
  const passphraseOk = passphrase === engagement.missionPassphrase ||
    crypto.createHash("sha256").update(passphrase).digest("hex") ===
    crypto.createHash("sha256").update(engagement.missionPassphrase).digest("hex");

  checks.push({
    name: "Mission Passphrase",
    passed: passphraseOk,
    detail: passphraseOk ? "Passphrase verified" : "Passphrase mismatch",
  });
  if (!passphraseOk) {
    violations.push({
      type: "operator-unverified",
      severity: "blocking",
      message: "Mission passphrase does not match ROE engagement",
      remediation: "Provide the correct mission passphrase from the signed ROE document",
    });
  }

  // ── Check 5: Target in scope ───────────────────────────────
  const inScope = isInScope(target, engagement.scope);
  checks.push({
    name: "Target Scope",
    passed: inScope,
    detail: inScope
      ? `Target "${target}" is in-scope`
      : `Target "${target}" is NOT in-scope`,
  });
  if (!inScope) {
    violations.push({
      type: "out-of-scope-target",
      severity: "blocking",
      message: `Target "${target}" is outside defined scope`,
      remediation: "Add the target to engagement.scope.inScope or choose a scoped target",
    });
  }

  // ── Check 6: Mission type permitted ────────────────────────
  const missionOk =
    engagement.permittedMissionTypes.length === 0 ||
    engagement.permittedMissionTypes.includes(missionType) ||
    engagement.permittedMissionTypes.includes("full-ghost");

  checks.push({
    name: "Mission Type Permitted",
    passed: missionOk,
    detail: missionOk
      ? `Mission type "${missionType}" is permitted`
      : `Mission type "${missionType}" is NOT in permitted list`,
  });
  if (!missionOk) {
    violations.push({
      type: "unauthorized-technique",
      severity: "blocking",
      message: `Mission type "${missionType}" not permitted by this engagement`,
      remediation: `Add "${missionType}" to permittedMissionTypes or use full-ghost`,
    });
  }

  // ── Check 7: Ghost mode level ──────────────────────────────
  const modeOrder: Record<string, number> = { passive: 0, stealth: 1, active: 2 };
  const modeOk = (modeOrder[ghostMode] ?? 0) <= (modeOrder[engagement.maxGhostMode] ?? 0);
  checks.push({
    name: "Ghost Mode Authorization",
    passed: modeOk,
    detail: modeOk
      ? `Mode "${ghostMode}" is within authorized limit "${engagement.maxGhostMode}"`
      : `Mode "${ghostMode}" exceeds authorized limit "${engagement.maxGhostMode}"`,
  });
  if (!modeOk) {
    violations.push({
      type: "unauthorized-technique",
      severity: "blocking",
      message: `Ghost mode "${ghostMode}" exceeds authorized max: "${engagement.maxGhostMode}"`,
      remediation: `Use passive or stealth mode, or get engagement updated to permit ${ghostMode}`,
    });
  }

  // ── Check 8: Time window ───────────────────────────────────
  const timeOk = isWithinTimeWindow(engagement.timeWindows);
  checks.push({
    name: "Time Window",
    passed: timeOk,
    detail: timeOk
      ? "Current time is within an authorized testing window"
      : "Current time is outside authorized testing windows",
  });
  if (!timeOk) {
    violations.push({
      type: "outside-time-window",
      severity: "blocking",
      message: "Testing outside of authorized time window",
      remediation: "Wait for an authorized time window or have client approve additional windows",
    });
  }

  // ── Determine approval ─────────────────────────────────────
  const blockingViolations = violations.filter((v) => v.severity === "blocking");
  const approved = blockingViolations.length === 0;

  // ── Build mission guidance ─────────────────────────────────
  const guidance = buildMissionGuidance(engagement, missionType, target);

  // ── Build operator brief ───────────────────────────────────
  const primaryContact = engagement.contacts.find((c) => c.role === "primary");
  const emergencyContact = engagement.contacts.find((c) => c.role === "emergency");

  const operatorBrief = [
    `╔══════════════════════════════════════════════════════╗`,
    `║          NATT MISSION OPERATOR BRIEF                 ║`,
    `╚══════════════════════════════════════════════════════╝`,
    ``,
    `ENGAGEMENT: ${engagement.name} [${engagement.id}]`,
    `CLASSIFICATION: ${engagement.classification.toUpperCase()}`,
    `CLIENT: ${engagement.client.name}`,
    `AUTHORIZING OFFICER: ${engagement.client.authorizingOfficer}`,
    ``,
    `TARGET: ${target}`,
    `MISSION TYPE: ${missionType}`,
    `GHOST MODE: ${ghostMode.toUpperCase()}`,
    ``,
    `VALID UNTIL: ${engagement.validUntil.toISOString()}`,
    ``,
    `PRIMARY CONTACT: ${primaryContact ? `${primaryContact.name} <${primaryContact.email}>` : "NOT SET"}`,
    `EMERGENCY: ${emergencyContact ? `${emergencyContact.name} <${emergencyContact.email}>` : "NOT SET"}`,
    ``,
    `JURISDICTION: ${engagement.legal.jurisdiction}`,
    `CONTRACT REF: ${engagement.legal.contractRef}`,
    ``,
    approved
      ? `✅ ROE VALIDATED — MISSION AUTHORIZED — PROCEED`
      : `❌ ROE VIOLATION — MISSION BLOCKED — ${blockingViolations.length} blocking violation(s)`,
    ``,
    ...(blockingViolations.length > 0
      ? blockingViolations.map((v) => `  ⛔ ${v.message}`)
      : []),
    ``,
    `HARD LIMITS (DO NOT CROSS):`,
    ...guidance.hardLimits.map((l) => `  • ${l}`),
    ``,
    `BREAK-GLASS: ${guidance.breakGlassProtocol}`,
  ].join("\n");

  // ── Audit log ──────────────────────────────────────────────
  const auditEntry: ROEAuditEntry = {
    timestamp: now,
    event: approved ? "mission_authorized" : "mission_blocked",
    operator,
    target,
    detail: approved
      ? `Mission ${missionType}/${ghostMode} on ${target} authorized`
      : `Mission blocked: ${blockingViolations.map((v) => v.type).join(", ")}`,
    severity: approved ? "info" : "violation",
  };
  engagement.auditLog.push(auditEntry);
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

// ─────────────────────────────────────────────────────────────────────────────
//  Guidance Builders
// ─────────────────────────────────────────────────────────────────────────────

function buildMissionGuidance(
  engagement: ROEEngagement,
  missionType: string,
  target: string
): MissionGuidance {
  const template = MISSION_GUIDANCE_TEMPLATES[missionType] ?? MISSION_GUIDANCE_TEMPLATES["full-ghost"]!;

  return {
    brief: [
      `You are NATT, operating under engagement "${engagement.name}".`,
      `Classification: ${engagement.classification.toUpperCase()}.`,
      `Target: ${target}`,
      `Authorized ghost mode: ${engagement.maxGhostMode}.`,
      `This engagement is authorized by ${engagement.client.authorizingOfficer} of ${engagement.client.name}.`,
      `Governing law: ${engagement.legal.jurisdiction}.`,
      `Contract: ${engagement.legal.contractRef}.`,
      `All findings are confidential and covered under the engagement agreement.`,
      `You must stop immediately if hard limits are reached and contact: ${engagement.contacts.find((c) => c.role === "primary")?.email ?? "primary contact"}.`,
    ].join(" "),
    ...template,
    // Override hard limits with engagement-specific forbidden techniques
    hardLimits: [
      ...template.hardLimits,
      ...engagement.forbiddenTechniques.map((t) => `FORBIDDEN TECHNIQUE: ${t}`),
    ],
  };
}

function buildDefaultGuidance(missionType: string): MissionGuidance {
  const template = MISSION_GUIDANCE_TEMPLATES[missionType] ?? MISSION_GUIDANCE_TEMPLATES["full-ghost"]!;
  return {
    brief: "No ROE engagement found. Mission blocked.",
    ...template,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Engagement Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new ROE engagement.
 *
 * @example
 * const engagement = await createROEEngagement({
 *   name: "FreakMe.fun Web App Assessment",
 *   scope: { inScope: ["freakme.fun", "*.freakme.fun"], outOfScope: [], includeSubdomains: true },
 *   client: { name: "Tolani Corp", contactEmail: "security@tolani.com", authorizingOfficer: "Terri T." },
 *   operator: { id: "op-001", name: "NATT Ghost", organization: "DevBot Security", credential: "OSCP-12345" },
 * });
 */
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
}): Promise<ROEEngagement> {
  const id = `roe-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date();
  const validUntil = new Date(now.getTime() + (params.validDays ?? 90) * 24 * 60 * 60 * 1000);

  const passphrase = params.missionPassphrase ?? crypto.randomBytes(16).toString("hex");

  const engagement: ROEEngagement = {
    id,
    name: params.name,
    classification: params.classification ?? "confidential",
    status: "approved",
    operator: params.operator,
    client: params.client,
    legal: {
      jurisdiction: "United States",
      contractRef: `SOW-${id}`,
      ...params.legal,
    },
    scope: params.scope,
    timeWindows: params.timeWindows ?? [],
    contacts: params.contacts ?? [],
    forbiddenTechniques: params.forbiddenTechniques ?? [
      "Denial of Service (DoS/DDoS)",
      "Destructive file operations",
      "Data exfiltration of real user data",
      "Social engineering of employees",
      "Physical access testing",
    ],
    permittedMissionTypes: params.permittedMissionTypes ?? [
      "web-app",
      "html-analysis",
      "api-recon",
      "network-recon",
      "osint",
      "auth-testing",
      "platform-detection",
      "code-analysis",
      "full-ghost",
    ],
    maxGhostMode: params.maxGhostMode ?? "stealth",
    validFrom: now,
    validUntil,
    missionPassphrase: passphrase,
    createdAt: now,
    updatedAt: now,
    auditLog: [
      {
        timestamp: now,
        event: "engagement_created",
        operator: params.operator.id,
        detail: `Engagement "${params.name}" created`,
        severity: "info",
      },
    ],
  };

  await saveEngagement(engagement);

  console.log(`[ROE] ✅ Engagement created: ${id}`);
  console.log(`[ROE] 🔑 Mission passphrase: ${passphrase}`);
  console.log(`[ROE] 📋 Valid until: ${validUntil.toISOString()}`);

  return engagement;
}

/**
 * Get or create a default engagement for dev/local testing.
 * Auto-approves localhost and 127.0.0.1 targets.
 */
export async function getOrCreateDefaultEngagement(operator: string = "local-dev"): Promise<ROEEngagement> {
  const engagements = await listEngagements();
  const existing = engagements.find((e) => e.name === "NATT Default Dev Engagement" && e.status === "approved");
  if (existing) return existing;

  return createROEEngagement({
    name: "NATT Default Dev Engagement",
    scope: {
      inScope: ["localhost", "127.0.0.1", "0.0.0.0", "::1", "*.local", "*.test", "*.dev"],
      outOfScope: [],
      includeSubdomains: false,
    },
    client: {
      name: "DevBot Internal",
      contactEmail: "security@devbot.internal",
      authorizingOfficer: "DevBot Security Team",
    },
    operator: {
      id: operator,
      name: "NATT Ghost Agent",
      organization: "DevBot Security",
      credential: "internal",
    },
    maxGhostMode: "active",
    missionPassphrase: "natt-dev-passphrase",
    validDays: 365,
    classification: "confidential",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Phase-level ROE gates (called during mission execution)
// ─────────────────────────────────────────────────────────────────────────────

export interface PhaseROEGate {
  phase: string;
  target: string;
  technique: string;
  approved: boolean;
  reason: string;
}

export function checkPhaseROE(
  engagement: ROEEngagement,
  phase: string,
  technique: string,
  target: string
): PhaseROEGate {
  // ── PATHFINDER MODE: bypass all phase gates ────────────────
  if (process.env.NATT_PATHFINDER === "true") {
    return {
      phase,
      target,
      technique,
      approved: true,
      reason: `PATHFINDER: technique "${technique}" fully authorized — no restrictions`,
    };
  }

  // Check forbidden techniques
  const forbidden = engagement.forbiddenTechniques.some(
    (ft) => ft.toLowerCase().includes(technique.toLowerCase())
  );

  if (forbidden) {
    return {
      phase,
      target,
      technique,
      approved: false,
      reason: `Technique "${technique}" is explicitly forbidden by engagement ROE`,
    };
  }

  // Check scope
  if (!isInScope(target, engagement.scope)) {
    return {
      phase,
      target,
      technique,
      approved: false,
      reason: `Target "${target}" is out of engagement scope`,
    };
  }

  return {
    phase,
    target,
    technique,
    approved: true,
    reason: `Phase "${phase}" / technique "${technique}" is within ROE bounds`,
  };
}
