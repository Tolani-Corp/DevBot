/**
 * DEBO Unchained — Offensive Security Extension
 * For certified ethical hackers operating under written authorization only.
 *
 * Every session requires a signed Rules of Engagement (RoE) before any
 * offensive capability is available. All actions are audit-logged immutably.
 *
 * Legal basis: identical to Metasploit Pro, Burp Suite Pro, Cobalt Strike.
 * Access: invite-only whitelist managed by Tolani Corp administrators.
 */

// ---------------------------------------------------------------------------
// Access & Certification
// ---------------------------------------------------------------------------

export type CertificationType =
  | "CEH"      // Certified Ethical Hacker (EC-Council)
  | "OSCP"     // Offensive Security Certified Professional
  | "GPEN"     // GIAC Penetration Tester
  | "GWAPT"    // GIAC Web Application Penetration Tester
  | "CPENT"    // Certified Penetration Testing Professional
  | "LPT"      // Licensed Penetration Tester
  | "CUSTOM";  // Custom org credential (reviewed manually)

export interface UnchainedOperator {
  operatorId: string;          // Internal ID (maps to workspace userId)
  workspaceId: string;
  displayName: string;
  certifications: CertificationType[];
  certVerifiedAt: Date;
  invitedBy: string;           // Admin who granted access
  invitedAt: Date;
  status: "active" | "suspended" | "revoked";
  totalSessions: number;
  lastSessionAt?: Date;
}

// ---------------------------------------------------------------------------
// Rules of Engagement (RoE) — mandatory per session
// ---------------------------------------------------------------------------

export interface RulesOfEngagement {
  roeId: string;
  operatorId: string;
  sessionId: string;

  /** Target scope declaration — all offensive ops are locked to these targets */
  targetScope: {
    domains?: string[];        // e.g. ["*.example.com", "api.example.com"]
    ipRanges?: string[];       // CIDR notation: ["192.168.1.0/24"]
    urls?: string[];           // Specific endpoints
    excludedTargets?: string[]; // Explicitly out-of-scope
  };

  /** Authorization proof */
  authorizationStatement: string;   // "I have written authorization from <client> to test <targets>"
  clientName: string;
  engagementType: "pentest" | "red_team" | "bug_bounty" | "ctf" | "lab";

  /** Legal acknowledgment — user must explicitly accept */
  operatorAcknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedText: string;   // Verbatim text operator agreed to

  /** Time-bound */
  validFrom: Date;
  validUntil: Date;

  /** Immutable hash of RoE for audit integrity */
  roeHash?: string;
}

export const ROE_ACKNOWLEDGMENT_TEXT = `
I, the operator, confirm that:

1. I have WRITTEN AUTHORIZATION from the target organization to conduct
   offensive security testing against the declared scope.

2. I will NOT use DEBO Unchained against any target outside the declared scope.

3. I understand that unauthorized use of these capabilities may constitute
   a criminal offense under the Computer Fraud and Abuse Act (CFAA), the
   Computer Misuse Act (UK), and equivalent laws in my jurisdiction.

4. I accept full legal responsibility for my actions during this session.

5. I understand that all actions are logged and may be shared with law
   enforcement if unauthorized use is suspected.

Type "I ACCEPT" to proceed.
`.trim();

// ---------------------------------------------------------------------------
// Offensive Capabilities
// ---------------------------------------------------------------------------

export type OffensiveCapability =
  // Web Application
  | "web_sqli"          // SQL injection payload generation
  | "web_xss"           // XSS payload generation
  | "web_ssrf"          // SSRF payload generation
  | "web_rce"           // Remote code execution vectors
  | "web_auth_bypass"   // Authentication bypass techniques
  | "web_ssti"          // Server-side template injection
  | "web_xxe"           // XML external entity injection
  | "web_deserialization" // Deserialization attack payloads
  // Network
  | "net_recon"         // Network reconnaissance automation
  | "net_port_scan"     // Port scanning (wraps nmap logic)
  | "net_service_enum"  // Service enumeration
  | "net_vuln_scan"     // Vulnerability scanning
  // Infrastructure
  | "infra_cloud_enum"  // Cloud resource enumeration (AWS/Azure/GCP)
  | "infra_secrets_hunt" // Exposed secrets/credential hunting
  | "infra_misconfig"   // Misconfiguration detection
  // OSINT
  | "osint_domain"      // Domain/subdomain enumeration
  | "osint_email"       // Email harvesting
  | "osint_employee"    // Employee enumeration (LinkedIn, etc.)
  // Social Engineering
  | "se_phishing_template" // Phishing email template generation
  | "se_pretext"        // Pretext scenario generation
  // Reporting
  | "report_findings"   // Auto-generate pentest findings
  | "report_cvss"       // CVSS scoring and risk rating
  | "report_remediation"; // Remediation recommendations

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export interface UnchainedSession {
  sessionId: string;
  operatorId: string;
  workspaceId: string;
  roe: RulesOfEngagement;
  startedAt: Date;
  endedAt?: Date;
  status: "active" | "completed" | "aborted";
  actions: UnchainedAction[];
}

export interface UnchainedAction {
  actionId: string;
  sessionId: string;
  operatorId: string;
  capability: OffensiveCapability;
  target: string;               // Must be within RoE scope
  prompt: string;               // Original operator prompt
  generatedPayload?: string;    // What DEBO generated
  timestamp: Date;
  scopeValidated: boolean;
  flagged?: boolean;            // If scope validation failed
}

// ---------------------------------------------------------------------------
// Audit Log — append-only
// ---------------------------------------------------------------------------

export interface UnchainedAuditEntry {
  auditId: string;
  timestamp: Date;
  operatorId: string;
  sessionId?: string;
  event:
    | "operator_invited"
    | "operator_suspended"
    | "operator_revoked"
    | "roe_created"
    | "roe_accepted"
    | "roe_rejected"
    | "session_started"
    | "session_ended"
    | "action_executed"
    | "scope_violation_blocked"
    | "scope_violation_flagged";
  detail: Record<string, unknown>;
  /** SHA-256 of (previousHash + JSON(entry)) — forms an audit chain */
  chainHash: string;
}
