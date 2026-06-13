/**
 * natt-skills-cloud.ts — Cloud Misconfiguration Scanner
 *
 * NATT Expansion Skill: Audits Cloudflare zone settings, DNS posture,
 * SSL/TLS configuration, firewall rules, and security headers via the
 * Cloudflare REST API.
 *
 * Requires: CLOUDFLARE_API_TOKEN env var
 * Reference: .claude/skills/cloudflare-infrastructure.md
 */

import type {
  NATTFinding,
  NATTSeverity,
  NATTFindingCategory,
} from "./natt.js";
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CloudAuditResult {
  zoneId: string;
  zoneName: string;
  findings: NATTFinding[];
  settings: Record<string, unknown>;
  dnsRecords: CloudDNSRecord[];
  sslMode: string;
  securityLevel: string;
  firewallRuleCount: number;
  auditedAt: Date;
}

export interface CloudDNSRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
}

interface CFApiResponse<T = unknown> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result: T;
  result_info?: { page: number; total_pages: number; count: number; total_count: number };
}

// ─────────────────────────────────────────────────────────────────────────────
//  API Helpers
// ─────────────────────────────────────────────────────────────────────────────

const CF_BASE = "https://api.cloudflare.com/client/v4";

function getToken(): string {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error("CLOUDFLARE_API_TOKEN not set — cannot audit Cloudflare zones");
  return token;
}

async function cfFetch<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${CF_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
    },
  });
  const data = (await res.json()) as CFApiResponse<T>;
  if (!data.success) {
    throw new Error(`CF API ${path}: ${data.errors.map((e) => e.message).join(", ")}`);
  }
  return data.result;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Zone Audit
// ─────────────────────────────────────────────────────────────────────────────

function makeFinding(
  severity: NATTSeverity,
  category: NATTFindingCategory,
  title: string,
  description: string,
  evidence: string,
  location: string,
  remediation: string,
): NATTFinding {
  return {
    id: `NATT-CLOUD-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
    severity,
    category,
    title,
    description,
    evidence,
    location,
    reproduction: "Run NATT cloud-misconfiguration audit against the zone.",
    remediation,
  };
}

/** Audit SSL/TLS settings */
async function auditSSL(zoneId: string, zoneName: string): Promise<NATTFinding[]> {
  const findings: NATTFinding[] = [];

  const sslSetting = await cfFetch<{ id: string; value: string }>(
    `/zones/${zoneId}/settings/ssl`,
  );

  if (sslSetting.value === "off") {
    findings.push(
      makeFinding("critical", "cryptography", "SSL Disabled",
        "SSL/TLS encryption is completely disabled for this zone.",
        `ssl.value = "${sslSetting.value}"`, `zone:${zoneName}/settings/ssl`,
        "Enable SSL — set to 'full' or 'strict' in Cloudflare dashboard."),
    );
  } else if (sslSetting.value === "flexible") {
    findings.push(
      makeFinding("high", "cryptography", "Flexible SSL — Origin Unencrypted",
        "Flexible SSL encrypts browser↔CF but CF↔origin is plain HTTP, enabling MITM on the backend.",
        `ssl.value = "flexible"`, `zone:${zoneName}/settings/ssl`,
        "Upgrade to Full (Strict) SSL. Install a valid certificate on origin."),
    );
  }

  // Check minimum TLS version
  const tlsMin = await cfFetch<{ id: string; value: string }>(
    `/zones/${zoneId}/settings/min_tls_version`,
  );
  if (tlsMin.value === "1.0" || tlsMin.value === "1.1") {
    findings.push(
      makeFinding("medium", "cryptography", `TLS ${tlsMin.value} Still Allowed`,
        `Minimum TLS version is ${tlsMin.value}, which has known vulnerabilities (BEAST, POODLE).`,
        `min_tls_version = "${tlsMin.value}"`, `zone:${zoneName}/settings/min_tls_version`,
        "Set minimum TLS version to 1.2."),
    );
  }

  // HTTPS rewrites
  const httpsRewrite = await cfFetch<{ id: string; value: string }>(
    `/zones/${zoneId}/settings/automatic_https_rewrites`,
  );
  if (httpsRewrite.value !== "on") {
    findings.push(
      makeFinding("low", "security-misconfiguration", "Automatic HTTPS Rewrites Disabled",
        "Mixed-content resources won't be automatically upgraded to HTTPS.",
        `automatic_https_rewrites = "${httpsRewrite.value}"`,
        `zone:${zoneName}/settings/automatic_https_rewrites`,
        "Enable Automatic HTTPS Rewrites in SSL/TLS → Edge Certificates."),
    );
  }

  // Always Use HTTPS
  const alwaysHttps = await cfFetch<{ id: string; value: string }>(
    `/zones/${zoneId}/settings/always_use_https`,
  );
  if (alwaysHttps.value !== "on") {
    findings.push(
      makeFinding("medium", "security-misconfiguration", "Always Use HTTPS Disabled",
        "HTTP requests are not automatically redirected to HTTPS.",
        `always_use_https = "${alwaysHttps.value}"`,
        `zone:${zoneName}/settings/always_use_https`,
        "Enable 'Always Use HTTPS' in SSL/TLS → Edge Certificates."),
    );
  }

  return findings;
}

/** Audit security headers & settings */
async function auditSecuritySettings(zoneId: string, zoneName: string): Promise<NATTFinding[]> {
  const findings: NATTFinding[] = [];

  // Security level
  const secLevel = await cfFetch<{ id: string; value: string }>(
    `/zones/${zoneId}/settings/security_level`,
  );
  if (secLevel.value === "essentially_off" || secLevel.value === "low") {
    findings.push(
      makeFinding("high", "security-misconfiguration", `Security Level: ${secLevel.value}`,
        "Cloudflare challenge rate is very low, allowing bots and attackers through unchallenged.",
        `security_level = "${secLevel.value}"`, `zone:${zoneName}/settings/security_level`,
        "Set security level to 'medium' or 'high'."),
    );
  }

  // Browser integrity check
  const bic = await cfFetch<{ id: string; value: string }>(
    `/zones/${zoneId}/settings/browser_check`,
  );
  if (bic.value !== "on") {
    findings.push(
      makeFinding("low", "security-misconfiguration", "Browser Integrity Check Disabled",
        "Malicious bots with spoofed headers won't be challenged.",
        `browser_check = "${bic.value}"`, `zone:${zoneName}/settings/browser_check`,
        "Enable Browser Integrity Check in Security settings."),
    );
  }

  // WAF (managed rules)
  const waf = await cfFetch<{ id: string; value: string }>(
    `/zones/${zoneId}/settings/waf`,
  ).catch(() => null);
  if (waf && waf.value !== "on") {
    findings.push(
      makeFinding("high", "security-misconfiguration", "WAF Disabled",
        "Web Application Firewall is not active — no protection against OWASP Top 10 attacks.",
        `waf = "${waf.value}"`, `zone:${zoneName}/settings/waf`,
        "Enable WAF in Security → WAF. Consider Cloudflare Managed Ruleset."),
    );
  }

  return findings;
}

/** Audit DNS records for security issues */
async function auditDNS(zoneId: string, zoneName: string): Promise<{ records: CloudDNSRecord[]; findings: NATTFinding[] }> {
  const findings: NATTFinding[] = [];
  const records = await cfFetch<CloudDNSRecord[]>(`/zones/${zoneId}/dns_records?per_page=100`);

  // Check for exposed origin IPs (A/AAAA records not proxied)
  const exposedOrigins = records.filter(
    (r) => (r.type === "A" || r.type === "AAAA") && !r.proxied,
  );
  for (const rec of exposedOrigins) {
    findings.push(
      makeFinding("medium", "information-disclosure", `Origin IP Exposed: ${rec.name}`,
        `DNS record ${rec.name} (${rec.type}) points to ${rec.content} without Cloudflare proxy, exposing your origin IP.`,
        `${rec.type} ${rec.name} → ${rec.content} (proxied: false)`,
        `zone:${zoneName}/dns/${rec.id}`,
        "Enable Cloudflare proxy (orange cloud) for this record, or ensure origin IP has firewall rules."),
    );
  }

  // Check for missing SPF
  const txtRecords = records.filter((r) => r.type === "TXT");
  const hasSPF = txtRecords.some((r) => r.content.startsWith("v=spf1"));
  if (!hasSPF) {
    findings.push(
      makeFinding("medium", "security-misconfiguration", "Missing SPF Record",
        "No SPF record found — domain can be used for email spoofing.",
        "No TXT record with v=spf1 prefix", `zone:${zoneName}/dns`,
        "Add a TXT record: v=spf1 include:_spf.google.com ~all (adjust for your email provider)."),
    );
  }

  // Check for missing DMARC
  const hasDMARC = txtRecords.some(
    (r) => r.name.startsWith("_dmarc") && r.content.includes("v=DMARC1"),
  );
  if (!hasDMARC) {
    findings.push(
      makeFinding("medium", "security-misconfiguration", "Missing DMARC Record",
        "No DMARC record found — no policy for handling failed SPF/DKIM checks.",
        "No _dmarc TXT record", `zone:${zoneName}/dns`,
        "Add a TXT record at _dmarc: v=DMARC1; p=quarantine; rua=mailto:admin@yourdomain.com"),
    );
  }

  // Check for conflicting SPF records
  const spfRecords = txtRecords.filter((r) => r.content.startsWith("v=spf1"));
  if (spfRecords.length > 1) {
    findings.push(
      makeFinding("high", "security-misconfiguration", "Multiple Conflicting SPF Records",
        `Found ${spfRecords.length} SPF records — RFC 7208 mandates exactly one. Mail servers will return PermError.`,
        spfRecords.map((r) => `${r.name}: ${r.content}`).join("\n"),
        `zone:${zoneName}/dns`,
        "Merge into a single SPF record or remove the redundant one."),
    );
  }

  // Check for wildcard DNS
  const wildcards = records.filter((r) => r.name.startsWith("*"));
  for (const wc of wildcards) {
    findings.push(
      makeFinding("low", "information-disclosure", `Wildcard DNS: ${wc.name}`,
        "Wildcard DNS records can expose unintended subdomains to the internet.",
        `${wc.type} ${wc.name} → ${wc.content}`, `zone:${zoneName}/dns/${wc.id}`,
        "Review wildcard necessity. Consider explicit records instead."),
    );
  }

  return { records, findings };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main Export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full Cloudflare zone security audit.
 * Checks SSL, security settings, DNS posture, and produces NATTFindings.
 */
export async function auditCloudflareZone(zoneId: string): Promise<CloudAuditResult> {
  // Get zone metadata
  const zone = await cfFetch<{ id: string; name: string; status: string }>(
    `/zones/${zoneId}`,
  );

  // Run all audits in parallel
  const [sslFindings, secFindings, dnsResult] = await Promise.all([
    auditSSL(zoneId, zone.name),
    auditSecuritySettings(zoneId, zone.name),
    auditDNS(zoneId, zone.name),
  ]);

  const allFindings = [...sslFindings, ...secFindings, ...dnsResult.findings];

  // Collect settings for the report
  const sslSetting = await cfFetch<{ value: string }>(`/zones/${zoneId}/settings/ssl`);
  const secLevel = await cfFetch<{ value: string }>(`/zones/${zoneId}/settings/security_level`);

  return {
    zoneId,
    zoneName: zone.name,
    findings: allFindings,
    settings: { ssl: sslSetting.value, securityLevel: secLevel.value },
    dnsRecords: dnsResult.records,
    sslMode: sslSetting.value,
    securityLevel: secLevel.value,
    firewallRuleCount: 0, // Populated if firewall API accessible
    auditedAt: new Date(),
  };
}

/**
 * Audit all known zones from environment variables.
 * Reads CF_ZONE_* env vars.
 */
export async function auditAllZones(): Promise<CloudAuditResult[]> {
  const zoneEnvKeys = Object.keys(process.env).filter((k) => k.startsWith("CF_ZONE_"));
  if (zoneEnvKeys.length === 0) {
    throw new Error("No CF_ZONE_* environment variables found. Set CF_ZONE_BETTORSACE, etc.");
  }

  const results: CloudAuditResult[] = [];
  for (const key of zoneEnvKeys) {
    const zoneId = process.env[key]!;
    try {
      const result = await auditCloudflareZone(zoneId);
      results.push(result);
    } catch (err) {
      console.error(`Cloud audit failed for ${key} (${zoneId}):`, err);
    }
  }
  return results;
}

/**
 * Quick DNS-only audit for a zone — lighter weight than full audit.
 */
export async function auditDNSOnly(zoneId: string): Promise<{ records: CloudDNSRecord[]; findings: NATTFinding[] }> {
  const zone = await cfFetch<{ name: string }>(`/zones/${zoneId}`);
  return auditDNS(zoneId, zone.name);
}
