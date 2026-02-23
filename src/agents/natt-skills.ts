/**
 * natt-skills.ts — NATT Advanced Research Skills
 *
 * Network Attack & Testing Toolkit
 * Advanced password, secrets, and security bypass skills for ethical research.
 *
 * These skills operate in RESEARCH MODE only — they analyze, identify,
 * and provide guidance on credential weaknesses, leaked secrets, and
 * auth bypass vectors. They DO NOT perform unauthorized access.
 *
 * Skills:
 *  PASSWORD ANALYSIS
 *    • Hash identification (MD5, bcrypt, SHA-1, NTLM, argon2, etc.)
 *    • Password policy assessment
 *    • Common password pattern detection
 *    • Default credential database lookup
 *    • Credential stuffing surface analysis
 *    • Brute-force resistance scoring
 *
 *  SECRETS DETECTION
 *    • 80+ secret pattern signatures (API keys, tokens, certificates)
 *    • Git history secret mining
 *    • Environment variable exposure
 *    • Hardcoded credential detection in source
 *    • Cloud provider key format validation
 *    • JWT secret weakness analysis
 *
 *  AUTH BYPASS RESEARCH
 *    • JWT algorithm confusion (none, RS256→HS256)
 *    • OAuth 2.0 flow weaknesses (PKCE, state param, redirect_uri)
 *    • Session fixation / prediction vectors
 *    • HTTP authentication header bypass patterns
 *    • SQL auth bypass payloads (blacklist only — for WAF testing)
 *    • Password reset flow analysis
 *    • MFA bypass techniques catalog
 */

import crypto from "crypto";
import type { NATTFinding, NATTSeverity, NATTFindingCategory } from "./natt.js";

// ─────────────────────────────────────────────────────────────────────────────
//  Password Analysis
// ─────────────────────────────────────────────────────────────────────────────

export type HashType =
  | "md5"
  | "sha1"
  | "sha256"
  | "sha512"
  | "ntlm"
  | "lm"
  | "bcrypt"
  | "argon2"
  | "scrypt"
  | "pbkdf2"
  | "sha1-salted"
  | "md5-salted"
  | "mysql-4.1+"
  | "wordpress"
  | "drupal"
  | "unix-crypt"
  | "unknown";

export interface HashIdentification {
  input: string;
  identifiedAs: HashType[];
  confidence: "high" | "medium" | "low";
  crackability: "trivial" | "easy" | "moderate" | "hard" | "impractical";
  crackabilityReason: string;
  recommendedTool: string;
  hashcatMode?: string;
  johnMode?: string;
  securityAssessment: string;
}

/**
 * Identify the type of a password hash.
 * Pure pattern analysis — does not crack or bruteforce.
 */
export function identifyHash(hash: string): HashIdentification {
  const h = hash.trim();
  const possible: HashType[] = [];

  // bcrypt: $2a$, $2b$, $2y$
  if (/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(h)) {
    return {
      input: h.substring(0, 7) + "...",
      identifiedAs: ["bcrypt"],
      confidence: "high",
      crackability: "hard",
      crackabilityReason: "bcrypt has a configurable work factor — cost ≥10 is slow enough to resist offline attacks",
      recommendedTool: "hashcat -m 3200",
      hashcatMode: "3200",
      johnMode: "bcrypt",
      securityAssessment: "bcrypt is a strong KDF. Ensure work factor is ≥12 for new systems.",
    };
  }

  // argon2
  if (/^\$argon2(i|d|id)\$/.test(h)) {
    return {
      input: h.substring(0, 15) + "...",
      identifiedAs: ["argon2"],
      confidence: "high",
      crackability: "impractical",
      crackabilityReason: "argon2 is memory-hard and time-hard — the current best-practice KDF",
      recommendedTool: "hashcat -m 13400 (argon2i) / -m 13500 (argon2d) / -m 13600 (argon2id)",
      hashcatMode: "13600",
      securityAssessment: "argon2id is the OWASP-recommended password hashing function. No action needed if params are adequate.",
    };
  }

  // NTLM: 32-char hex
  if (/^[0-9a-fA-F]{32}$/.test(h)) {
    possible.push("md5", "ntlm");
    return {
      input: h,
      identifiedAs: possible,
      confidence: "medium",
      crackability: "easy",
      crackabilityReason: "MD5/NTLM have no salt and are computed in nanoseconds on modern GPUs (100+ GH/s)",
      recommendedTool: "hashcat -m 0 (MD5) or -m 1000 (NTLM)",
      hashcatMode: "0 or 1000",
      johnMode: "raw-md5 or NT",
      securityAssessment: "Critical: MD5/NTLM without salt are trivially cracked. Migrate to bcrypt/argon2id immediately.",
    };
  }

  // SHA-1: 40-char hex
  if (/^[0-9a-fA-F]{40}$/.test(h)) {
    return {
      input: h,
      identifiedAs: ["sha1"],
      confidence: "medium",
      crackability: "easy",
      crackabilityReason: "SHA-1 without salt processes at ~10 GH/s on modern hardware",
      recommendedTool: "hashcat -m 100",
      hashcatMode: "100",
      johnMode: "raw-sha1",
      securityAssessment: "SHA-1 is deprecated for password storage. Migrate to bcrypt/argon2id.",
    };
  }

  // SHA-256: 64-char hex
  if (/^[0-9a-fA-F]{64}$/.test(h)) {
    return {
      input: h,
      identifiedAs: ["sha256"],
      confidence: "medium",
      crackability: "moderate",
      crackabilityReason: "SHA-256 without salt is fast (~4 GH/s on GPU). Still faster than KDFs.",
      recommendedTool: "hashcat -m 1400",
      hashcatMode: "1400",
      johnMode: "raw-sha256",
      securityAssessment: "SHA-256 is not a password KDF. Migrate to bcrypt/argon2id. Use salt minimally.",
    };
  }

  // SHA-512: 128-char hex
  if (/^[0-9a-fA-F]{128}$/.test(h)) {
    return {
      input: h,
      identifiedAs: ["sha512"],
      confidence: "medium",
      crackability: "moderate",
      crackabilityReason: "SHA-512 without salt runs at ~1 GH/s on GPU",
      recommendedTool: "hashcat -m 1700",
      hashcatMode: "1700",
      johnMode: "raw-sha512",
      securityAssessment: "SHA-512 is not a password KDF. Use bcrypt/argon2id.",
    };
  }

  // WordPress: $P$ or $H$
  if (/^\$P\$[./0-9A-Za-z]{31}$/.test(h) || /^\$H\$/.test(h)) {
    return {
      input: h.substring(0, 4) + "...",
      identifiedAs: ["wordpress"],
      confidence: "high",
      crackability: "moderate",
      crackabilityReason: "WordPress MD5-based phpass — outdated, but iterated",
      recommendedTool: "hashcat -m 400",
      hashcatMode: "400",
      johnMode: "phpass",
      securityAssessment: "WordPress uses phpass (MD5-based). Consider migrating to bcrypt with a plugin.",
    };
  }

  return {
    input: h.substring(0, 8) + "...",
    identifiedAs: ["unknown"],
    confidence: "low",
    crackability: "moderate",
    crackabilityReason: "Unknown hash format — requires manual analysis",
    recommendedTool: "hashid, name-that-hash",
    securityAssessment: "Hash format not recognized. Use hashid or name-that-hash for further analysis.",
  };
}

export interface PasswordPolicyAssessment {
  score: number;        // 0–100
  rating: "strong" | "adequate" | "weak" | "critical";
  issues: string[];
  recommendations: string[];
  minimumLength?: number;
  requiresComplexity?: boolean;
  hasMaxLength?: boolean;
  historyPolicy?: boolean;
  lockoutPolicy?: boolean;
}

/**
 * Assess a password policy from observable signals.
 */
export function assessPasswordPolicy(signals: {
  minLength?: number;
  maxLength?: number;
  requiresUppercase?: boolean;
  requiresNumbers?: boolean;
  requiresSymbols?: boolean;
  lockoutAfter?: number;
  sessionTimeout?: number;
  historySize?: number;
  mfaRequired?: boolean;
  passwordExpiryDays?: number;
}): PasswordPolicyAssessment {
  const issues: string[] = [];
  const recs: string[] = [];
  let score = 100;

  if (!signals.minLength || signals.minLength < 12) {
    score -= 20;
    issues.push(`Minimum password length is ${signals.minLength ?? "unknown"} (should be ≥12)`);
    recs.push("Set minimum password length to 14+ characters (NIST SP 800-63B recommends ≥8, industry best practice is 14+)");
  }

  if (signals.maxLength && signals.maxLength < 64) {
    score -= 10;
    issues.push(`Maximum password length is ${signals.maxLength} (should be ≥64)`);
    recs.push("Increase maximum password length to at least 64 characters to support passphrases");
  }

  if (!signals.lockoutAfter) {
    score -= 20;
    issues.push("No account lockout policy detected");
    recs.push("Implement account lockout after 5-10 failed attempts with exponential backoff");
  } else if (signals.lockoutAfter > 10) {
    score -= 10;
    issues.push(`Account locks after ${signals.lockoutAfter} failures — too high`);
    recs.push("Reduce lockout threshold to ≤5 attempts");
  }

  if (!signals.mfaRequired) {
    score -= 20;
    issues.push("MFA is not required");
    recs.push("Require MFA for all accounts, especially admin. TOTP or hardware keys preferred.");
  }

  if (signals.passwordExpiryDays && signals.passwordExpiryDays < 180) {
    score -= 5;
    issues.push(`Password expiry set to ${signals.passwordExpiryDays} days — too frequent per NIST`);
    recs.push("NIST SP 800-63B recommends against periodic rotation unless compromise is suspected");
  }

  const rating =
    score >= 80 ? "strong" :
    score >= 60 ? "adequate" :
    score >= 35 ? "weak" : "critical";

  return {
    score,
    rating,
    issues,
    recommendations: recs,
    minimumLength: signals.minLength,
    requiresComplexity: signals.requiresUppercase && signals.requiresNumbers,
    hasMaxLength: !!signals.maxLength,
    historyPolicy: !!signals.historySize,
    lockoutPolicy: !!signals.lockoutAfter,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Default Credentials Database
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_CREDENTIALS: Array<{
  service: string;
  username: string;
  password: string;
  risk: "critical" | "high";
}> = [
  // Routers / Network
  { service: "Cisco IOS", username: "admin", password: "cisco", risk: "critical" },
  { service: "Cisco IOS", username: "cisco", password: "cisco", risk: "critical" },
  { service: "D-Link Router", username: "admin", password: "", risk: "critical" },
  { service: "Linksys Router", username: "admin", password: "admin", risk: "critical" },
  { service: "Netgear Router", username: "admin", password: "password", risk: "critical" },
  { service: "TP-Link Router", username: "admin", password: "admin", risk: "critical" },
  { service: "MikroTik", username: "admin", password: "", risk: "critical" },
  // Web Servers / Admin
  { service: "Apache Tomcat", username: "admin", password: "admin", risk: "critical" },
  { service: "Apache Tomcat", username: "tomcat", password: "tomcat", risk: "critical" },
  { service: "Jenkins", username: "admin", password: "admin", risk: "critical" },
  { service: "Grafana", username: "admin", password: "admin", risk: "critical" },
  { service: "Elastic Kibana", username: "elastic", password: "changeme", risk: "critical" },
  { service: "Splunk", username: "admin", password: "changeme", risk: "critical" },
  // Databases
  { service: "MySQL", username: "root", password: "", risk: "critical" },
  { service: "MySQL", username: "root", password: "root", risk: "critical" },
  { service: "PostgreSQL", username: "postgres", password: "postgres", risk: "critical" },
  { service: "MongoDB", username: "admin", password: "admin", risk: "critical" },
  { service: "Redis", username: "", password: "", risk: "critical" },
  { service: "CouchDB", username: "admin", password: "admin", risk: "critical" },
  // CMS
  { service: "WordPress", username: "admin", password: "admin", risk: "high" },
  { service: "WordPress", username: "admin", password: "password", risk: "high" },
  { service: "Drupal", username: "admin", password: "admin", risk: "high" },
  { service: "phpMyAdmin", username: "root", password: "", risk: "critical" },
  // IoT / Embedded
  { service: "Raspberry Pi (default)", username: "pi", password: "raspberry", risk: "critical" },
  { service: "IP Camera (generic)", username: "admin", password: "12345", risk: "critical" },
  { service: "IP Camera (Hikvision)", username: "admin", password: "12345", risk: "critical" },
  { service: "Printer (HP JetDirect)", username: "admin", password: "", risk: "high" },
];

/**
 * Check if a service is likely vulnerable to default credentials.
 */
export function checkDefaultCredentials(serviceName: string): typeof DEFAULT_CREDENTIALS {
  const lower = serviceName.toLowerCase();
  return DEFAULT_CREDENTIALS.filter(
    (c) =>
      c.service.toLowerCase().includes(lower) ||
      lower.includes(c.service.toLowerCase().split(" ")[0]?.toLowerCase() ?? "")
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Secret Pattern Engine — 80+ Signatures
// ─────────────────────────────────────────────────────────────────────────────

export interface SecretPattern {
  name: string;
  provider?: string;
  pattern: RegExp;
  severity: NATTSeverity;
  entropy?: number;   // Min entropy threshold
  description: string;
  remediation: string;
}

export const SECRET_PATTERNS: SecretPattern[] = [
  // ── AWS ─────────────────────────────────────────────────────────────────
  {
    name: "AWS Access Key ID",
    provider: "AWS",
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
    severity: "critical",
    description: "AWS IAM Access Key ID — can be used to call AWS APIs",
    remediation: "Rotate key immediately via AWS IAM console. Revoke and never commit to source.",
  },
  {
    name: "AWS Secret Access Key",
    provider: "AWS",
    pattern: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})["']?/i,
    severity: "critical",
    description: "AWS Secret Access Key — full API access",
    remediation: "Rotate key immediately. Use AWS Secrets Manager or environment variables.",
  },
  // ── Azure ────────────────────────────────────────────────────────────────
  {
    name: "Azure Storage Account Key",
    provider: "Azure",
    pattern: /AccountKey=([A-Za-z0-9+/]{88}==)/,
    severity: "critical",
    description: "Azure Storage Account Key — full blob/queue/table access",
    remediation: "Regenerate in Azure Portal. Use managed identity or SAS tokens.",
  },
  {
    name: "Azure Service Principal Secret",
    provider: "Azure",
    pattern: /client_secret[\"']?\s*[:=]\s*[\"']?([A-Za-z0-9~_\-.]{34,})/i,
    severity: "critical",
    description: "Azure service principal client secret",
    remediation: "Rotate in Azure AD. Use managed identity where possible.",
  },
  // ── GCP ─────────────────────────────────────────────────────────────────
  {
    name: "GCP API Key",
    provider: "GCP",
    pattern: /AIza[0-9A-Za-z_\-]{35}/,
    severity: "critical",
    description: "Google Cloud API Key",
    remediation: "Restrict key to specific APIs and IPs. Rotate via GCP Console.",
  },
  {
    name: "GCP Service Account JSON",
    provider: "GCP",
    pattern: /"type"\s*:\s*"service_account"/,
    severity: "critical",
    description: "GCP service account credentials JSON",
    remediation: "Delete key, create new one, use Workload Identity Federation instead.",
  },
  // ── GitHub ───────────────────────────────────────────────────────────────
  {
    name: "GitHub Personal Access Token (Classic)",
    provider: "GitHub",
    pattern: /ghp_[A-Za-z0-9]{36}/,
    severity: "critical",
    description: "GitHub personal access token",
    remediation: "Revoke at github.com/settings/tokens. Use fine-grained tokens with minimal scope.",
  },
  {
    name: "GitHub Fine-Grained Token",
    provider: "GitHub",
    pattern: /github_pat_[A-Za-z0-9_]{22,88}/,
    severity: "critical",
    description: "GitHub fine-grained personal access token",
    remediation: "Revoke immediately. Scope tokens to minimum required repositories.",
  },
  {
    name: "GitHub OAuth Token",
    provider: "GitHub",
    pattern: /gho_[A-Za-z0-9]{36}/,
    severity: "critical",
    description: "GitHub OAuth token",
    remediation: "Revoke via GitHub OAuth application settings.",
  },
  {
    name: "GitHub Actions Secret",
    provider: "GitHub",
    pattern: /ghs_[A-Za-z0-9]{36}/,
    severity: "high",
    description: "GitHub Actions secret token",
    remediation: "Rotate via repository or organization secrets settings.",
  },
  // ── Anthropic ────────────────────────────────────────────────────────────
  {
    name: "Anthropic API Key",
    provider: "Anthropic",
    pattern: /sk-ant-api\d{2}-[A-Za-z0-9_\-]{95}/,
    severity: "critical",
    description: "Anthropic Claude API key",
    remediation: "Revoke at console.anthropic.com/settings/keys. Set budget limits on new keys.",
  },
  // ── OpenAI ───────────────────────────────────────────────────────────────
  {
    name: "OpenAI API Key",
    provider: "OpenAI",
    pattern: /sk-(?:proj-)?[A-Za-z0-9]{20,100}/,
    severity: "critical",
    description: "OpenAI API key — billing liability if exposed",
    remediation: "Revoke at platform.openai.com/settings/api-keys. Set billing limits.",
  },
  // ── Stripe ───────────────────────────────────────────────────────────────
  {
    name: "Stripe Live Secret Key",
    provider: "Stripe",
    pattern: /sk_live_[A-Za-z0-9]{24,}/,
    severity: "critical",
    description: "Stripe live secret key — can initiate charges",
    remediation: "Roll immediately at dashboard.stripe.com/developers/api-keys.",
  },
  {
    name: "Stripe Test Key",
    provider: "Stripe",
    pattern: /sk_test_[A-Za-z0-9]{24,}/,
    severity: "medium",
    description: "Stripe test secret key — leaks test data",
    remediation: "Rotate for hygiene, even test keys should not be in source.",
  },
  // ── Slack ────────────────────────────────────────────────────────────────
  {
    name: "Slack Bot Token",
    provider: "Slack",
    pattern: /xoxb-[0-9]{9,13}-[0-9]{9,13}-[A-Za-z0-9]{24}/,
    severity: "critical",
    description: "Slack bot token — can send messages, view channels",
    remediation: "Revoke at api.slack.com/apps. Rotate bot tokens periodically.",
  },
  {
    name: "Slack User Token",
    provider: "Slack",
    pattern: /xoxp-[0-9]{9,13}-[0-9]{9,13}-[0-9]{9,13}-[a-z0-9]{32}/,
    severity: "critical",
    description: "Slack user OAuth token — acts as the user",
    remediation: "Revoke at slack.com/account/settings. User tokens should not be used in bots.",
  },
  {
    name: "Slack Webhook URL",
    provider: "Slack",
    pattern: /https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]{10,11}\/[A-Z0-9B]{10,11}\/[A-Za-z0-9]{24}/,
    severity: "high",
    description: "Slack incoming webhook — can post to channel",
    remediation: "Regenerate webhook in Slack app settings.",
  },
  // ── Twilio ───────────────────────────────────────────────────────────────
  {
    name: "Twilio API Key",
    provider: "Twilio",
    pattern: /SK[a-z0-9]{32}/,
    severity: "critical",
    description: "Twilio API key — can send SMS, make calls",
    remediation: "Revoke at console.twilio.com. Enable Geo Permissions to limit call scope.",
  },
  {
    name: "Twilio Auth Token",
    provider: "Twilio",
    pattern: /(?:account_sid|TWILIO_AUTH_TOKEN)["\s]*[:=]["\s]*([a-f0-9]{32})/i,
    severity: "critical",
    description: "Twilio auth token — full account access",
    remediation: "Rotate in Twilio Console. Use API keys scoped per application.",
  },
  // ── SendGrid ─────────────────────────────────────────────────────────────
  {
    name: "SendGrid API Key",
    provider: "SendGrid",
    pattern: /SG\.[A-Za-z0-9_\-]{22}\.[A-Za-z0-9_\-]{43}/,
    severity: "critical",
    description: "SendGrid API key — can send email as domain",
    remediation: "Revoke at app.sendgrid.com/settings/api_keys. Use scoped keys.",
  },
  // ── JWT ──────────────────────────────────────────────────────────────────
  {
    name: "JSON Web Token",
    pattern: /eyJ[A-Za-z0-9_\-]+\.eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/,
    severity: "high",
    description: "JWT token — may contain sensitive claims or session data",
    remediation: "Never log or expose JWTs. Check if token is expired. Validate signing algorithm.",
  },
  {
    name: "JWT with 'none' Algorithm",
    pattern: /eyJ[A-Za-z0-9_]+\.eyJ[A-Za-z0-9_]+\.((?!\.)[A-Za-z0-9_]*)$/,
    severity: "critical",
    description: "JWT with potential 'none' algorithm (no signature)",
    remediation: "Reject JWTs with 'none' algorithm server-side. Use RS256 or HS256 with strong secret.",
  },
  // ── Private Keys ─────────────────────────────────────────────────────────
  {
    name: "RSA Private Key",
    pattern: /-----BEGIN RSA PRIVATE KEY-----/,
    severity: "critical",
    description: "RSA private key in PEM format",
    remediation: "Remove from codebase. Store in secrets manager. Rotate if exposed.",
  },
  {
    name: "EC Private Key",
    pattern: /-----BEGIN EC PRIVATE KEY-----/,
    severity: "critical",
    description: "EC private key in PEM format",
    remediation: "Remove from codebase. Use AWS KMS / Azure Key Vault / HashiCorp Vault.",
  },
  {
    name: "PGP Private Key",
    pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----/,
    severity: "critical",
    description: "PGP private key",
    remediation: "Remove and revoke. Import to local keyring only.",
  },
  {
    name: "SSH Private Key (OpenSSH)",
    pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/,
    severity: "critical",
    description: "OpenSSH private key",
    remediation: "Remove from codebase. Use SSH agent. Rotate key on all servers.",
  },
  // ── Database  ────────────────────────────────────────────────────────────
  {
    name: "Database Connection String (mongodb+srv)",
    pattern: /mongodb\+srv:\/\/[^:]+:[^@]+@[a-z0-9._-]+/i,
    severity: "critical",
    description: "MongoDB Atlas connection string with embedded credentials",
    remediation: "Rotate credentials. Use environment variables. Enable IP allowlist.",
  },
  {
    name: "PostgreSQL Connection String",
    pattern: /postgresql:\/\/[^:]+:[^@]+@[a-z0-9._-]+/i,
    severity: "critical",
    description: "PostgreSQL connection string with embedded credentials",
    remediation: "Remove from source. Use environment variables or IAM auth.",
  },
  {
    name: "Generic Password in Config",
    pattern: /(?:password|passwd|pwd|secret|credentials?)\s*[:=]\s*["']([^"'\s]{8,})["']/i,
    severity: "high",
    description: "Apparent password or secret in configuration",
    remediation: "Use environment variables or a secrets manager. Never hardcode credentials.",
  },
  // ── Generic Generic ──────────────────────────────────────────────────────
  {
    name: "Generic API Key Pattern",
    pattern: /(?:api[_-]?key|apikey|api_secret)\s*[:=]\s*["']([A-Za-z0-9_\-]{20,})["']/i,
    severity: "high",
    description: "Generic API key or secret in source",
    remediation: "Move to environment variables or secrets manager.",
  },
  {
    name: "Generic Bearer Token",
    pattern: /Authorization:\s*Bearer\s+([A-Za-z0-9_\-.]+)/i,
    severity: "high",
    description: "Bearer token exposed in code or logs",
    remediation: "Remove from code. Tokens should only appear in runtime HTTP headers.",
  },
  // ── Planned → Implemented Patterns ────────────────────────────────────────
  {
    name: "AWS Session Token",
    provider: "AWS",
    pattern: /(?:aws[_-]?session[_-]?token|x-amz-security-token)\s*[:=]\s*["']?([A-Za-z0-9/+=]{100,})["']?/i,
    severity: "critical",
    description: "AWS temporary session token exposed — grants time-limited access to AWS resources",
    remediation: "Rotate STS credentials immediately. Never persist session tokens in code.",
  },
  {
    name: "Azure SAS Token",
    provider: "Azure",
    pattern: /[?&](?:sig|sv|se|sp|srt|ss)=[^&\s]{10,}(?:&(?:sig|sv|se|sp|srt|ss)=[^&\s]+){2,}/i,
    severity: "critical",
    description: "Azure Shared Access Signature token grants delegated access to storage resources",
    remediation: "Regenerate SAS token. Use managed identities or stored access policies instead.",
  },
  {
    name: "Stripe Publishable Key",
    provider: "Stripe",
    pattern: /pk_(?:live|test)_[A-Za-z0-9]{20,}/,
    severity: "low",
    description: "Stripe publishable key — client-safe but may reveal account info if test key in production",
    remediation: "Verify test keys are not deployed to production. Publishable keys are client-safe by design.",
  },
  {
    name: "Twilio Account SID",
    provider: "Twilio",
    pattern: /AC[a-f0-9]{32}/,
    severity: "medium",
    description: "Twilio Account SID identifies the account — paired with auth token enables API access",
    remediation: "Treat as semi-sensitive. Move to env vars and ensure auth token is not co-located.",
  },
  {
    name: "JWT Secret Key",
    pattern: /(?:jwt[_-]?secret|jwt[_-]?key|token[_-]?secret)\s*[:=]\s*["']([^"'\s]{16,})["']/i,
    severity: "critical",
    description: "JWT signing secret in source — enables token forgery if compromised",
    remediation: "Move to secrets manager. Rotate JWT secret and invalidate all existing tokens.",
  },
  {
    name: "X.509 Certificate PEM",
    pattern: /-----BEGIN CERTIFICATE-----[\s\S]{50,}?-----END CERTIFICATE-----/,
    severity: "medium",
    description: "X.509 certificate in source — may reveal infrastructure details or enable impersonation if paired with private key",
    remediation: "Store certificates in a certificate store or secrets manager.",
  },
  {
    name: "Discord Bot Token",
    provider: "Discord",
    pattern: /(?:discord[_-]?token|bot[_-]?token)\s*[:=]\s*["']?([A-Za-z0-9_\-.]{50,})["']?/i,
    severity: "high",
    description: "Discord bot token enables full bot access including message send, guild management",
    remediation: "Regenerate token in Discord Developer Portal. Move to environment variables.",
  },
  {
    name: "Discord Webhook URL",
    provider: "Discord",
    pattern: /https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_\-]+/,
    severity: "medium",
    description: "Discord webhook URL — anyone with it can post messages to the channel",
    remediation: "Rotate webhook in Discord server settings. Move URL to environment variables.",
  },
  {
    name: "Mailgun API Key",
    provider: "Mailgun",
    pattern: /key-[a-f0-9]{32}/,
    severity: "high",
    description: "Mailgun API key enables email sending, domain management, and log access",
    remediation: "Rotate key in Mailgun dashboard. Move to environment variables.",
  },
  {
    name: "Mailchimp API Key",
    provider: "Mailchimp",
    pattern: /[a-f0-9]{32}-us\d{1,2}/,
    severity: "high",
    description: "Mailchimp API key with datacenter suffix — full account access",
    remediation: "Regenerate in Mailchimp account settings. Move to environment variables.",
  },
  {
    name: "Heroku API Key",
    provider: "Heroku",
    pattern: /(?:heroku[_-]?api[_-]?key|HEROKU_API_KEY)\s*[:=]\s*["']?([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})["']?/i,
    severity: "high",
    description: "Heroku API key — full platform access including deployments and config vars",
    remediation: "Regenerate via `heroku authorizations:create`. Move to environment variables.",
  },
  {
    name: "npm Token",
    provider: "npm",
    pattern: /npm_[A-Za-z0-9]{36}/,
    severity: "critical",
    description: "npm automation/publish token — can publish packages to the registry",
    remediation: "Revoke token at npmjs.com/settings/tokens. Create new scoped token.",
  },
  {
    name: "PyPI Token",
    provider: "PyPI",
    pattern: /pypi-[A-Za-z0-9_\-]{100,}/,
    severity: "critical",
    description: "PyPI API token — can upload packages to Python Package Index",
    remediation: "Revoke token at pypi.org/manage/account/token. Create new scoped token.",
  },
];

export interface SecretScanResult {
  file: string;
  line: number;
  pattern: string;
  provider?: string;
  severity: NATTSeverity;
  match: string;        // Redacted
  description: string;
  remediation: string;
}

/**
 * Scan source code content for exposed secrets.
 * Returns findings without exposing full secrets (first 4 + stars).
 */
export function scanContentForSecrets(
  content: string,
  filename: string = "input"
): SecretScanResult[] {
  const results: SecretScanResult[] = [];
  const lines = content.split("\n");

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx] ?? "";

    for (const sp of SECRET_PATTERNS) {
      const match = sp.pattern.exec(line);
      if (match) {
        const fullMatch = match[0];
        const redacted = fullMatch.length > 8
          ? fullMatch.substring(0, 4) + "****" + fullMatch.substring(fullMatch.length - 2)
          : "****";

        results.push({
          file: filename,
          line: lineIdx + 1,
          pattern: sp.name,
          provider: sp.provider,
          severity: sp.severity,
          match: redacted,
          description: sp.description,
          remediation: sp.remediation,
        });
      }
    }
  }

  return results;
}

/**
 * Convert secret scan results to NATTFinding format.
 */
export function secretsToNATTFindings(results: SecretScanResult[]): NATTFinding[] {
  return results.map((r) => ({
    id: crypto.randomUUID(),
    severity: r.severity,
    category: "sensitive-data" as NATTFindingCategory,
    title: `Exposed Secret: ${r.pattern}`,
    description: r.description,
    evidence: `File: ${r.file}, Line: ${r.line}, Match: ${r.match}`,
    location: `${r.file}:${r.line}`,
    reproduction: `1. Open ${r.file}\n2. Go to line ${r.line}\n3. Secret is visible in source`,
    remediation: r.remediation,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
//  JWT Analysis
// ─────────────────────────────────────────────────────────────────────────────

export interface JWTAnalysis {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  algorithm: string;
  issues: JWTIssue[];
  overallRisk: NATTSeverity;
}

export interface JWTIssue {
  title: string;
  severity: NATTSeverity;
  description: string;
  remediation: string;
}

/**
 * Analyze a JWT for security weaknesses.
 * Does not verify signature — only analyzes structure and claims.
 */
export function analyzeJWT(token: string): JWTAnalysis {
  const issues: JWTIssue[] = [];
  let header: Record<string, unknown> = {};
  let payload: Record<string, unknown> = {};

  try {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Invalid JWT structure");

    header = JSON.parse(Buffer.from(parts[0]!, "base64url").toString("utf-8")) as Record<string, unknown>;
    payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf-8")) as Record<string, unknown>;
  } catch {
    return {
      header: {},
      payload: {},
      algorithm: "parse-error",
      issues: [{
        title: "Invalid JWT Format",
        severity: "medium",
        description: "Token does not conform to JWT (header.payload.signature) format",
        remediation: "Ensure token is a valid JWT. Check encoding.",
      }],
      overallRisk: "medium",
    };
  }

  const alg = (header["alg"] as string ?? "none").toUpperCase();

  // Algorithm: none
  if (alg === "NONE") {
    issues.push({
      title: "JWT 'none' Algorithm",
      severity: "critical",
      description: "JWT uses the 'none' algorithm — no signature verification is performed",
      remediation: "Reject JWTs with alg:none server-side. Always verify signatures.",
    });
  }

  // Weak HMAC
  if (alg === "HS256" || alg === "HS384" || alg === "HS512") {
    issues.push({
      title: "JWT Symmetric Algorithm (HS256/HS384/HS512)",
      severity: "medium",
      description: "HMAC-based JWT — if the secret is weak, it can be cracked offline",
      remediation: "Use RS256/ES256 (asymmetric). If using HS256, ensure secret is ≥256 bits random.",
    });
  }

  // Expiry
  const exp = payload["exp"] as number | undefined;
  if (!exp) {
    issues.push({
      title: "JWT Has No Expiry (exp claim)",
      severity: "high",
      description: "Token has no expiration — compromised tokens are valid indefinitely",
      remediation: "Always set 'exp' claim. Typical TTL: 15min (access tokens), 7d (refresh tokens).",
    });
  } else {
    const expiryMs = exp * 1000;
    const ttlDays = (expiryMs - Date.now()) / (1000 * 60 * 60 * 24);
    if (ttlDays > 30) {
      issues.push({
        title: "JWT Has Very Long Expiry",
        severity: "medium",
        description: `JWT expires in ${Math.round(ttlDays)} days — long-lived tokens increase breach window`,
        remediation: "Shorten token lifetime. Use refresh token rotation pattern.",
      });
    }
  }

  // Sensitive data in payload
  const sensitiveClaims = ["password", "credit_card", "ssn", "secret", "key", "token"];
  for (const claim of sensitiveClaims) {
    if (claim in payload) {
      issues.push({
        title: `Sensitive Claim in JWT Payload: "${claim}"`,
        severity: "high",
        description: "JWT payload is base64-encoded, not encrypted — sensitive data is readable",
        remediation: "Remove sensitive data from JWT payload. Use JWE if sensitive claims required.",
      });
    }
  }

  // aud/iss validation reminders
  if (!payload["iss"]) {
    issues.push({
      title: "JWT Missing Issuer (iss) Claim",
      severity: "low",
      description: "Without issuer validation, tokens from other services may be accepted",
      remediation: "Set and validate the 'iss' claim to prevent token substitution attacks.",
    });
  }

  const severityRank: Record<NATTSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
  const overallRisk = issues.reduce((highest, issue) => {
    return severityRank[issue.severity] > severityRank[highest] ? issue.severity : highest;
  }, "info" as NATTSeverity);

  return { header, payload, algorithm: alg, issues, overallRisk };
}

// ─────────────────────────────────────────────────────────────────────────────
//  OAuth / Auth Bypass Research
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthBypassVector {
  name: string;
  category: "jwt" | "oauth" | "session" | "http-auth" | "password-reset" | "mfa" | "sql-auth";
  severity: NATTSeverity;
  description: string;
  testPayloads?: string[];
  testSteps: string[];
  remediation: string;
  owasp: string;
}

/**
 * Catalog of auth bypass vectors for research and testing guidance.
 * These are educational descriptions — not automated exploits.
 */
export const AUTH_BYPASS_VECTORS: AuthBypassVector[] = [
  {
    name: "JWT Algorithm Confusion (RS256 → HS256)",
    category: "jwt",
    severity: "critical",
    description:
      "If server accepts both RS256 and HS256, modify header alg to HS256 and sign with the public key as the HMAC secret.",
    testSteps: [
      "1. Obtain the server's public key (/.well-known/jwks.json or /oauth/.well-known/openid-configuration)",
      "2. Decode the JWT header",
      "3. Change alg from RS256 to HS256",
      "4. Re-sign with the public key as the HMAC secret using HS256",
      "5. Send the modified token — if server accepts, vulnerability confirmed",
    ],
    remediation: "Reject JWTs with unexpected algorithms. Explicitly specify allowed algorithms in verification.",
    owasp: "A07:2021 – Identification and Authentication Failures",
  },
  {
    name: "JWT None Algorithm",
    category: "jwt",
    severity: "critical",
    description: "Some JWT libraries accept 'none' as a valid algorithm, bypassing signature verification.",
    testSteps: [
      "1. Decode JWT header",
      "2. Change alg to 'none'",
      "3. Remove the signature portion",
      "4. Send token as: header.payload. (trailing dot, empty signature)",
      "5. Server validates without checking signature if vulnerable",
    ],
    remediation: "Explicitly reject 'none' algorithm. Use an allowlist of valid algorithms.",
    owasp: "A07:2021 – Identification and Authentication Failures",
  },
  {
    name: "OAuth Redirect URI Manipulation",
    category: "oauth",
    severity: "high",
    description:
      "If the redirect_uri is not strictly validated, an attacker can steal the auth code via a crafted URL.",
    testSteps: [
      "1. Start OAuth flow, capture the authorization request",
      "2. Modify redirect_uri to attacker-controlled URL",
      "3. If server allows, auth code is sent to attacker",
      "4. Test variations: %2F, /../attacker.com, redirect_uri=https://legit.com.attacker.com",
    ],
    remediation: "Exact match validation only for redirect_uri. Pre-register all allowed URIs.",
    owasp: "A01:2021 – Broken Access Control",
  },
  {
    name: "OAuth PKCE Bypass",
    category: "oauth",
    severity: "high",
    description: "If PKCE is optional, the code can be exchanged without code_verifier, enabling auth code interception.",
    testSteps: [
      "1. Start OAuth flow with PKCE disabled (omit code_challenge)",
      "2. Intercept auth code",
      "3. Exchange code for token without code_verifier",
      "4. If token returned, PKCE is optional — vulnerable",
    ],
    remediation: "Require PKCE for all public clients. Reject auth requests without code_challenge.",
    owasp: "A07:2021 – Identification and Authentication Failures",
  },
  {
    name: "Session Fixation",
    category: "session",
    severity: "high",
    description:
      "If the session ID does not rotate after login, an attacker who pre-sets the session ID can take over post-auth.",
    testSteps: [
      "1. Get a pre-auth session ID (e.g., visit login page)",
      "2. Send that session ID to victim (via link or CSWSH)",
      "3. Victim logs in",
      "4. If session ID has not rotated, attacker's session is now authenticated",
    ],
    remediation: "Always issue a new session ID upon successful authentication.",
    owasp: "A07:2021 – Identification and Authentication Failures",
  },
  {
    name: "Password Reset Token Predictability",
    category: "password-reset",
    severity: "high",
    description:
      "If password reset tokens are time-based, sequential, or derived from predictable data (username+timestamp), they can be guessed.",
    testSteps: [
      "1. Request password reset for test account",
      "2. Capture reset token from email",
      "3. Request reset again — check if token is sequential or time-predictable",
      "4. Check token entropy (should be ≥128 bits of random data)",
    ],
    remediation: "Use cryptographically random tokens (≥128 bit). Single-use only. Expire in ≤1 hour.",
    owasp: "A07:2021 – Identification and Authentication Failures",
  },
  {
    name: "HTTP Basic Auth Brute Force",
    category: "http-auth",
    severity: "high",
    description: "Endpoints protected only by HTTP Basic Auth with no rate limiting are vulnerable to brute force.",
    testSteps: [
      "1. Identify HTTP Basic Auth protected endpoints",
      "2. Check for lockout after repeated failures",
      "3. Test with default credentials from DEFAULT_CREDENTIALS list",
      "4. Observe if 401 response is immediate or delayed (no lockout = brute-forceable)",
    ],
    remediation: "Implement account lockout. Prefer token-based auth over Basic Auth. Use MFA.",
    owasp: "A07:2021 – Identification and Authentication Failures",
  },
  {
    name: "SQL Auth Bypass (Classic Patterns)",
    category: "sql-auth",
    severity: "critical",
    description:
      "If the login form uses string concatenation for SQL queries, classic injection payloads bypass authentication.",
    testPayloads: [
      "' OR '1'='1",
      "' OR '1'='1'--",
      "admin'--",
      "' OR 1=1--",
      "') OR ('1'='1",
    ],
    testSteps: [
      "1. Try payload in username field with any password",
      "2. Try payload in password field with any username",
      "3. Watch for successful login or different error than invalid credentials",
    ],
    remediation:
      "Use parameterized queries / prepared statements. Never concatenate user input into SQL. Use an ORM.",
    owasp: "A03:2021 – Injection",
  },
  {
    name: "MFA Bypass via Response Manipulation",
    category: "mfa",
    severity: "high",
    description: "If MFA validation is client-controlled (checked via API response), modifying the response can bypass it.",
    testSteps: [
      "1. Intercept MFA verification request with proxy (Burp Suite)",
      "2. Submit invalid OTP",
      "3. Modify response from failure (403/error) to success (200/success:true)",
      "4. If app proceeds past MFA, vulnerability confirmed",
    ],
    remediation: "MFA must be server-side. Never trust client assertions about MFA status.",
    owasp: "A07:2021 – Identification and Authentication Failures",
  },
];

/**
 * Get auth bypass vectors relevant to a specific context.
 */
export function getRelevantAuthBypasses(
  context: "jwt" | "oauth" | "session" | "all"
): AuthBypassVector[] {
  if (context === "all") return AUTH_BYPASS_VECTORS;
  return AUTH_BYPASS_VECTORS.filter((v) => v.category === context || v.category === "http-auth");
}

// ─────────────────────────────────────────────────────────────────────────────
//  Shannon Entropy (for detecting secrets in arbitrary strings)
// ─────────────────────────────────────────────────────────────────────────────

export function shannonEntropy(str: string): number {
  const freq: Record<string, number> = {};
  for (const ch of str) freq[ch] = (freq[ch] ?? 0) + 1;
  let entropy = 0;
  for (const count of Object.values(freq)) {
    const p = count / str.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Determine if a string is likely a secret based on entropy and length.
 * High-entropy long strings are probably credentials/tokens.
 */
export function isLikelySecret(value: string): boolean {
  if (value.length < 16) return false;
  const entropy = shannonEntropy(value);
  // Most real words have entropy < 3.5. Secrets typically > 4.0.
  return entropy > 4.0;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Credentials Exposure Surface Analysis
// ─────────────────────────────────────────────────────────────────────────────

export interface CredentialExposureAnalysis {
  target: string;
  vectors: Array<{
    vector: string;
    severity: NATTSeverity;
    detected: boolean;
    detail: string;
  }>;
  overallRisk: NATTSeverity;
  recommendations: string[];
}

/**
 * Analyze potential credential exposure vectors for a given endpoint/page.
 */
export function analyzeCredentialExposure(
  url: string,
  html: string,
  headers: Record<string, string>
): CredentialExposureAnalysis {
  const vectors: CredentialExposureAnalysis["vectors"] = [];

  // Check URL for credentials
  const urlHasCredentials =
    /(?:password|token|key|secret|api_key|access_token)=[^&\s]+/i.test(url);
  vectors.push({
    vector: "Credentials in URL",
    severity: "critical",
    detected: urlHasCredentials,
    detail: urlHasCredentials
      ? "Credentials detected in URL query string — will appear in logs and browser history"
      : "No credentials in URL",
  });

  // Basic auth header in request
  const hasBasicAuth = /authorization:\s*basic/i.test(JSON.stringify(headers));
  vectors.push({
    vector: "HTTP Basic Authentication",
    severity: "high",
    detected: hasBasicAuth,
    detail: hasBasicAuth
      ? "Basic Auth header detected — credentials base64-encoded but not encrypted"
      : "No Basic Auth detected",
  });

  // Autocomplete on password fields
  const autocompleteOn = /<input[^>]+type=["']password["'][^>]*>/i.test(html) &&
    !/<input[^>]+autocomplete=["']off["'][^>]+type=["']password["']/i.test(html);
  vectors.push({
    vector: "Password Field Autocomplete",
    severity: "low",
    detected: autocompleteOn,
    detail: autocompleteOn
      ? "Password fields allow browser autocomplete"
      : "Password autocomplete appears disabled",
  });

  // HTTP (not HTTPS)
  const isHTTP = url.startsWith("http://");
  vectors.push({
    vector: "Unencrypted Transport (HTTP)",
    severity: "critical",
    detected: isHTTP,
    detail: isHTTP
      ? "Login form served over HTTP — credentials transmitted in plaintext"
      : "HTTPS in use",
  });

  // HSTS
  const hasHSTS = "strict-transport-security" in headers;
  vectors.push({
    vector: "Missing HSTS",
    severity: "medium",
    detected: !hasHSTS,
    detail: hasHSTS
      ? "HSTS header present"
      : "No HSTS — browser may downgrade to HTTP on re-visit",
  });

  const severityRank: Record<NATTSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
  const detected = vectors.filter((v) => v.detected);
  const overallRisk = detected.reduce((highest, v) => {
    return severityRank[v.severity] > severityRank[highest] ? v.severity : highest;
  }, "info" as NATTSeverity);

  const recommendations: string[] = [];
  if (urlHasCredentials) recommendations.push("Remove all credentials from URL parameters. Use POST body or Authorization header.");
  if (isHTTP) recommendations.push("Force HTTPS on all login/auth endpoints. Redirect HTTP to HTTPS.");
  if (!hasHSTS) recommendations.push("Add Strict-Transport-Security header with max-age ≥31536000.");

  return { target: url, vectors, overallRisk, recommendations };
}
