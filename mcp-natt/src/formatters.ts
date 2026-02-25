import {
  type ROETemplate,
  type PasswordAttackTechnique,
  type AuthBypassTechnique,
} from "./knowledge.js";

import {
  type ScraperTechnique,
  type DefenseCategory,
} from "./media-security.js";

import {
  type JwtAttackType,
  type JwtDefenseCategory,
  type JwtSeverity,
  type JwtAttackPattern,
  type JwtDefensePlaybook,
} from "./jwt-security.js";

import {
  type VpnProtocol,
  type VpnLeakType,
  type VpnDefenseCategory,
  type VpnProvider,
  type VpnSeverity,
  type VpnLeakPattern,
  type VpnDefensePlaybook as VpnDefensePlaybookType,
  type VpnProviderProfile,
} from "./vpn-security.js";

export function formatJwtAttack(a: JwtAttackPattern): string {
  const lines = [
    `# [${a.severity.toUpperCase()} CVSS:${a.cvss}] ${a.name}`,
    `**ID:** ${a.id}`,
    `**Attack Type:** ${a.attack}`,
    `**CWEs:** ${a.cwes.join(", ")}`,
    `**Automatable:** ${a.automatable ? "Yes ⚙️" : "Manual 🔧"}`,
    ``,
    a.description,
  ];
  if (a.prerequisites.length > 0) {
    lines.push(``, `## Prerequisites`, a.prerequisites.map((p: string) => `- ${p}`).join("\n"));
  }
  lines.push(``, `## Steps`, a.steps.map((s: string) => s).join("\n"));
  if (a.payloads.length > 0) {
    lines.push(``, `## Payloads`, "\`\`\`", ...a.payloads, "\`\`\`");
  }
  lines.push(
    ``, `## Indicators`, a.indicators.map((i: string) => `- 🎯 ${i}`).join("\n"),
    ``, `## Detection`, a.detectionMethods.map((d: string) => `- 🔍 ${d}`).join("\n"),
    ``, `## Tools`, a.tools.map((t: string) => `- ${t}`).join("\n"),
    ``, `## Remediation`, a.remediation.map((r: string) => `- ✅ ${r}`).join("\n"),
    ``, `## References`, a.references.map((r: string) => `- ${r}`).join("\n"),
  );
  return lines.join("\n");
}

export function formatJwtDefense(d: JwtDefensePlaybook): string {
  const lines = [
    `# ${d.name}`,
    `**ID:** ${d.id}`,
    `**Category:** ${d.category}`,
    `**Effectiveness:** ${d.effectiveness}/10`,
    `**Mitigates:** ${d.mitigatesAttacks.join(", ")}`,
    ``,
    d.description,
    ``,
    `## Principle`,
    d.implementation.principle,
  ];
  if (d.implementation.codeExamples.length > 0) {
    lines.push(``, `## Code Examples`);
    for (const ex of d.implementation.codeExamples) {
      lines.push(``, `### ${ex.language}`, "\`\`\`", ex.code, "\`\`\`", ex.notes);
    }
  }
  if (d.implementation.configuration.length > 0) {
    lines.push(``, `## Configuration`, d.implementation.configuration.map((c: string) => `- ${c}`).join("\n"));
  }
  if (d.implementation.commonMistakes.length > 0) {
    lines.push(``, `## Common Mistakes`, d.implementation.commonMistakes.map((m: string) => `- ❌ ${m}`).join("\n"));
  }
  if (d.testCases.length > 0) {
    lines.push(``, `## Test Cases`);
    for (const tc of d.testCases) {
      lines.push(
        ``, `### ${tc.name} ${tc.automatable ? "⚙️" : "🔧"}`,
        tc.description,
        `**Steps:**`, tc.steps.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n"),
        `**Expected:** ${tc.expected}`,
      );
    }
  }
  lines.push(``, `## References`, d.references.map((r: string) => `- ${r}`).join("\n"));
  return lines.join("\n");
}

export function formatScraperPattern(p: { id: string; technique: string; name: string; description: string; attackVector: string; indicatorPatterns: string[]; httpSignatures: { userAgents?: string[]; headers?: Record<string, string>; requestPatterns?: string[] }; detectionMethods: string[]; defenses: string[]; severity: string; reference: string }): string {
  const lines = [
    `# [${p.severity.toUpperCase()}] ${p.name}`,
    `**ID:** ${p.id}`,
    `**Technique:** ${p.technique}`,
    ``,
    p.description,
    ``,
    `## Attack Vector`,
    p.attackVector,
  ];
  if (p.indicatorPatterns.length > 0) {
    lines.push(``, `## Indicator Patterns`, "\`\`\`", ...p.indicatorPatterns, "\`\`\`");
  }
  if (p.httpSignatures.userAgents && p.httpSignatures.userAgents.length > 0) {
    lines.push(``, `## Known User-Agents`, p.httpSignatures.userAgents.map((u) => `- \`${u}\``).join("\n"));
  }
  if (p.httpSignatures.requestPatterns && p.httpSignatures.requestPatterns.length > 0) {
    lines.push(``, `## Request Patterns`, p.httpSignatures.requestPatterns.map((r) => `- ${r}`).join("\n"));
  }
  lines.push(
    ``, `## Detection Methods`, p.detectionMethods.map((d) => `- 🔍 ${d}`).join("\n"),
    ``, `## Defenses`, p.defenses.map((d) => `- 🛡 ${d}`).join("\n"),
    ``, `**Reference:** ${p.reference}`,
  );
  return lines.join("\n");
}

export function formatDefensePlaybook(p: { id: string; category: string; name: string; description: string; implementation: { serverSide: string[]; clientSide: string[]; cdnConfig?: string[] }; testCases: Array<{ name: string; description: string; steps: string[]; expectedResult: string; automatable: boolean }>; mitigates: string[]; bypassDifficulty: number }): string {
  const lines = [
    `# ${p.name}`,
    `**ID:** ${p.id}`,
    `**Category:** ${p.category}`,
    `**Bypass Difficulty:** ${p.bypassDifficulty}/10`,
    `**Mitigates:** ${p.mitigates.join(", ")}`,
    ``,
    p.description,
    ``,
    `## Server-Side Implementation`,
    p.implementation.serverSide.map((s) => `- ${s}`).join("\n"),
    ``,
    `## Client-Side Implementation`,
    p.implementation.clientSide.map((s) => `- ${s}`).join("\n"),
  ];
  if (p.implementation.cdnConfig && p.implementation.cdnConfig.length > 0) {
    lines.push(``, `## CDN Configuration`, p.implementation.cdnConfig.map((c) => `- ${c}`).join("\n"));
  }
  if (p.testCases.length > 0) {
    lines.push(``, `## Test Cases`);
    for (const tc of p.testCases) {
      lines.push(
        ``, `### ${tc.name} ${tc.automatable ? "⚙️" : "🔧"}`,
        tc.description,
        `**Steps:**`, tc.steps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
        `**Expected:** ${tc.expectedResult}`,
      );
    }
  }
  return lines.join("\n");
}

export function formatROETemplate(template: ROETemplate): string {
  return [
    `# ROE Template: ${template.name}`,
    `**Mission Type:** ${template.missionType}`,
    `**Classification:** ${template.classification}`,
    ``,
    `## Description`,
    template.description,
    ``,
    `## Scope Guidance`,
    template.scopeGuidance.map((s) => `- ${s}`).join("\n"),
    ``,
    `## Time Window Guidance`,
    template.timeWindowGuidance,
    ``,
    `## Forbidden Techniques`,
    template.forbiddenTechniques.map((t) => `- ❌ ${t}`).join("\n"),
    ``,
    `## Required Contacts`,
    template.requiredContacts.map((c) => `- ${c}`).join("\n"),
    ``,
    `## Evidence Requirements`,
    template.evidenceRequirements.map((e) => `- ${e}`).join("\n"),
  ].join("\n");
}

export function formatAuthBypassTechnique(t: AuthBypassTechnique): string {
  return [
    `## [${t.severity.toUpperCase()}] ${t.name}`,
    `**Category:** ${t.category}`,
    ``,
    t.description,
    ``,
    `**Prerequisites:**`,
    t.prerequisites.map((p) => `- ${p}`).join("\n"),
    ``,
    `**Test Steps:**`,
    t.steps.map((s) => `${s}`).join("\n"),
    ...(t.payloads
      ? [
          ``,
          `**Payloads:**`,
          "\`\`\`",
          t.payloads.join("\n"),
          "\`\`\`",
        ]
      : []),
    ``,
    `**Remediation:** ${t.remediation}`,
    `**References:** ${t.references.join(", ")}`,
  ].join("\n");
}

export function buildMissionGuidanceText(missionType: string): string {
  const guidanceMap: Record<string, string> = {
    "web-app": [
      "# Web App Mission Guidance",
      "## Objectives",
      "- Enumerate all entry points (forms, params, headers, cookies)",
      "- Test for OWASP Top 10 vulnerabilities",
      "- Assess authentication and session management",
      "## Hard Limits",
      "- ❌ DO NOT submit forms that trigger financial transactions",
      "- ❌ DO NOT delete, modify, or exfiltrate real user data",
      "- ❌ DO NOT trigger notifications to real users",
      "## Approved Techniques",
      "- Passive crawling and spidering",
      "- Header and response analysis",
      "- Input validation testing with test payloads",
      "- Session token analysis",
      "## Break-Glass Protocol",
      "Cease all testing. Capture state. Contact primary contact within 15 minutes.",
    ].join("\n"),
    "network-recon": [
      "# Network Recon Mission Guidance",
      "## Objectives",
      "- Map live hosts and open ports",
      "- Identify running services and versions",
      "- Assess SSL/TLS posture",
      "## Hard Limits",
      "- ❌ DO NOT run denial-of-service or flood scans",
      "- ❌ DO NOT scan out-of-scope CIDR ranges",
      "- ❌ Max nmap timing -T3 on production",
      "## Break-Glass Protocol",
      "Stop all scanning immediately. Contact NOC.",
    ].join("\n"),
    "osint": [
      "# OSINT Mission Guidance",
      "## Objectives",
      "- Map digital footprint from public sources",
      "- Discover subdomains, email patterns, exposed credentials",
      "## Hard Limits",
      "- ❌ Passive sources only",
      "- ❌ DO NOT contact individuals discovered in OSINT",
      "- ❌ DO NOT create fake accounts",
      "## Break-Glass Protocol",
      "Cease collection. If active threat found, escalate within 30 minutes.",
    ].join("\n"),
  };

  return guidanceMap[missionType] ?? guidanceMap["web-app"]!;
}

export function identifyHashLocal(hash: string): Record<string, unknown> {
  const h = hash.trim();
  if (/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(h)) {
    return { type: "bcrypt", crackability: "hard", hashcatMode: "3200" };
  }
  if (/^\$argon2(i|d|id)\$/.test(h)) {
    return { type: "argon2", crackability: "impractical", hashcatMode: "13600" };
  }
  if (/^[0-9a-fA-F]{32}$/.test(h)) {
    return { type: "md5 or ntlm", crackability: "easy", hashcatMode: "0 (MD5) or 1000 (NTLM)" };
  }
  if (/^[0-9a-fA-F]{40}$/.test(h)) {
    return { type: "sha1", crackability: "easy", hashcatMode: "100" };
  }
  if (/^[0-9a-fA-F]{64}$/.test(h)) {
    return { type: "sha256", crackability: "moderate", hashcatMode: "1400" };
  }
  if (/^[0-9a-fA-F]{128}$/.test(h)) {
    return { type: "sha512", crackability: "moderate", hashcatMode: "1700" };
  }
  if (/^\$P\$[./0-9A-Za-z]{31}$/.test(h)) {
    return { type: "wordpress phpass", crackability: "moderate", hashcatMode: "400" };
  }
  return { type: "unknown", crackability: "unknown", suggestion: "Use hashid or name-that-hash" };
}

export const SECRET_PATTERNS_INFO = [
  { name: "AWS Access Key ID", provider: "AWS", pattern: "AKIA[0-9A-Z]{16}", severity: "critical" },
  { name: "GitHub Personal Access Token", provider: "GitHub", pattern: "ghp_[A-Za-z0-9]{36}", severity: "critical" },
  { name: "Anthropic API Key", provider: "Anthropic", pattern: "sk-ant-api\\d{2}-[A-Za-z0-9_-]{95}", severity: "critical" },
  { name: "OpenAI API Key", provider: "OpenAI", pattern: "sk-(?:proj-)?[A-Za-z0-9]{20,100}", severity: "critical" },
  { name: "Stripe Live Key", provider: "Stripe", pattern: "sk_live_[A-Za-z0-9]{24,}", severity: "critical" },
  { name: "GCP API Key", provider: "GCP", pattern: "AIza[0-9A-Za-z_-]{35}", severity: "critical" },
  { name: "Slack Bot Token", provider: "Slack", pattern: "xoxb-[0-9]{9,13}-[0-9]{9,13}-[A-Za-z0-9]{24}", severity: "critical" },
  { name: "JWT Token", provider: "Generic", pattern: "eyJ[A-Za-z0-9_-]+\\.eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+", severity: "high" },
  { name: "RSA Private Key", provider: "PKI", pattern: "-----BEGIN RSA PRIVATE KEY-----", severity: "critical" },
  { name: "SSH Private Key", provider: "PKI", pattern: "-----BEGIN OPENSSH PRIVATE KEY-----", severity: "critical" },
  { name: "Generic Password", provider: "Generic", pattern: "(?:password|passwd|pwd)\\s*[:=]\\s*[\"'][^\"'\\s]{8,}[\"']", severity: "high" },
];

export interface SecretResult {
  file: string;
  line: number;
  pattern: string;
  provider: string;
  severity: string;
  match: string;
}

export function scanContentLocal(content: string, filename: string): SecretResult[] {
  const results: SecretResult[] = [];
  const lines = content.split("\n");

  const PATTERNS: Array<{ name: string; provider: string; pattern: RegExp; severity: string }> = [
    { name: "AWS Access Key ID", provider: "AWS", pattern: /\bAKIA[0-9A-Z]{16}\b/, severity: "critical" },
    { name: "GitHub PAT Classic", provider: "GitHub", pattern: /ghp_[A-Za-z0-9]{36}/, severity: "critical" },
    { name: "GitHub Fine-Grained", provider: "GitHub", pattern: /github_pat_[A-Za-z0-9_]{22,88}/, severity: "critical" },
    { name: "Anthropic API Key", provider: "Anthropic", pattern: /sk-ant-api\d{2}-[A-Za-z0-9_\-]{95}/, severity: "critical" },
    { name: "OpenAI API Key", provider: "OpenAI", pattern: /sk-(?:proj-)?[A-Za-z0-9]{20,100}/, severity: "critical" },
    { name: "Stripe Live Key", provider: "Stripe", pattern: /sk_live_[A-Za-z0-9]{24,}/, severity: "critical" },
    { name: "GCP API Key", provider: "GCP", pattern: /AIza[0-9A-Za-z_\-]{35}/, severity: "critical" },
    { name: "Slack Bot Token", provider: "Slack", pattern: /xoxb-[0-9]{9,13}-[0-9]{9,13}-[A-Za-z0-9]{24}/, severity: "critical" },
    { name: "Slack Webhook", provider: "Slack", pattern: /https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]{10,11}\/[A-Z0-9]{10,11}\/[A-Za-z0-9]{24}/, severity: "high" },
    { name: "JWT Token", provider: "Generic", pattern: /eyJ[A-Za-z0-9_\-]+\.eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/, severity: "high" },
    { name: "RSA Private Key", provider: "PKI", pattern: /-----BEGIN RSA PRIVATE KEY-----/, severity: "critical" },
    { name: "SSH Private Key", provider: "PKI", pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/, severity: "critical" },
    { name: "MongoDB Connection", provider: "MongoDB", pattern: /mongodb\+srv:\/\/[^:]+:[^@]+@[a-z0-9._-]+/i, severity: "critical" },
    { name: "Generic Password", provider: "Generic", pattern: /(?:password|passwd|pwd)\s*[:=]\s*["']([^"'\s]{8,})["']/i, severity: "high" },
    { name: "Generic API Key", provider: "Generic", pattern: /(?:api_key|apikey|api-key)\s*[:=]\s*["']([A-Za-z0-9_\-]{20,})["']/i, severity: "high" },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    for (const sp of PATTERNS) {
      if (sp.pattern.test(line)) {
        const match = sp.pattern.exec(line)?.[0] ?? "";
        const redacted = match.length > 8
          ? match.substring(0, 4) + "****" + match.substring(match.length - 2)
          : "****";
        results.push({
          file: filename,
          line: i + 1,
          pattern: sp.name,
          provider: sp.provider,
          severity: sp.severity,
          match: redacted,
        });
      }
    }
  }
  return results;
}

export function formatVpnProtocol(p: { protocol: VpnProtocol; name: string; securityRating: 1 | 2 | 3 | 4 | 5; strengths: readonly string[]; weaknesses: readonly string[]; recommendedCiphers: readonly string[]; deprecatedCiphers: readonly string[]; portOptions: readonly number[]; obfuscationSupport: boolean; auditStatus: "audited" | "partial" | "none"; knownVulnerabilities: readonly string[]; bestPractices: readonly string[] }): string {
  const stars = "★".repeat(p.securityRating) + "☆".repeat(5 - p.securityRating);
  const lines = [
    `# ${p.name}`,
    `**Protocol:** ${p.protocol}`,
    `**Security Rating:** ${stars} (${p.securityRating}/5)`,
    `**Audit Status:** ${p.auditStatus === "audited" ? "✅ Audited" : p.auditStatus === "partial" ? "⚠️ Partial Audit" : "❌ Unaudited"}`,
    `**Obfuscation:** ${p.obfuscationSupport ? "✅ Supported" : "❌ Not Supported"}`,
    `**Ports:** ${p.portOptions.join(", ")}`,
    ``,
    `## Strengths`,
    p.strengths.map((s) => `- ✅ ${s}`).join("\n"),
    ``,
    `## Weaknesses`,
    p.weaknesses.map((w) => `- ⚠️ ${w}`).join("\n"),
  ];
  if (p.recommendedCiphers.length > 0) {
    lines.push(``, `## Recommended Ciphers`, p.recommendedCiphers.map((c) => `- \`${c}\``).join("\n"));
  }
  if (p.deprecatedCiphers.length > 0) {
    lines.push(``, `## Deprecated Ciphers (DO NOT USE)`, p.deprecatedCiphers.map((c) => `- ❌ \`${c}\``).join("\n"));
  }
  if (p.knownVulnerabilities.length > 0) {
    lines.push(``, `## Known Vulnerabilities`, p.knownVulnerabilities.map((v) => `- 🔓 ${v}`).join("\n"));
  }
  lines.push(``, `## Best Practices`, p.bestPractices.map((b) => `- 🛡 ${b}`).join("\n"));
  return lines.join("\n");
}

export function formatVpnLeak(l: VpnLeakPattern): string {
  const lines = [
    `# [${l.severity.toUpperCase()} CVSS:${l.cvss}] ${l.name}`,
    `**ID:** ${l.id}`,
    `**Leak Type:** ${l.type}`,
    `**CWE:** ${l.cwe}`,
    `**Automatable:** ${l.automatable ? "Yes ⚙️" : "Manual 🔧"}`,
    ``,
    l.description,
    ``,
    `## Detection Methods`,
    l.detectionMethods.map((d) => `- 🔍 ${d}`).join("\n"),
    ``,
    `## Indicators`,
    l.indicators.map((i) => `- 🎯 ${i}`).join("\n"),
    ``,
    `## Test Steps`,
    l.testSteps.map((s) => s).join("\n"),
    ``,
    `## Tools`,
    l.tools.map((t) => `- ${t}`).join("\n"),
    ``,
    `## Remediation`,
    l.remediation.map((r) => `- ✅ ${r}`).join("\n"),
  ];
  if (l.references.length > 0) {
    lines.push(``, `## References`, l.references.map((r) => `- ${r}`).join("\n"));
  }
  return lines.join("\n");
}

export function formatVpnDefense(d: VpnDefensePlaybookType): string {
  const lines = [
    `# ${d.name}`,
    `**ID:** ${d.id}`,
    `**Category:** ${d.category}`,
    `**Effectiveness:** ${d.effectiveness}/10`,
    `**Mitigates:** ${d.mitigatesLeaks.length > 0 ? d.mitigatesLeaks.join(", ") : "N/A"}`,
    ``,
    d.description,
    ``,
    `## Principle`,
    d.implementation.principle,
  ];
  if (d.implementation.codeExamples.length > 0) {
    lines.push(``, `## Code Examples`);
    for (const ex of d.implementation.codeExamples) {
      lines.push(``, `### ${ex.language}`, "\`\`\`", ex.code, "\`\`\`", ex.notes);
    }
  }
  if (d.implementation.configuration.length > 0) {
    lines.push(``, `## Configuration`, d.implementation.configuration.map((c) => `- ${c}`).join("\n"));
  }
  if (d.implementation.commonMistakes.length > 0) {
    lines.push(``, `## Common Mistakes`, d.implementation.commonMistakes.map((m) => `- ❌ ${m}`).join("\n"));
  }
  if (d.testCases.length > 0) {
    lines.push(``, `## Test Cases`);
    for (const tc of d.testCases) {
      lines.push(
        ``, `### ${tc.name} ${tc.automatable ? "⚙️" : "🔧"}`,
        tc.description,
        `**Steps:**`, tc.steps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
        `**Expected:** ${tc.expected}`,
      );
    }
  }
  lines.push(``, `## References`, d.references.map((r) => `- ${r}`).join("\n"));
  return lines.join("\n");
}

export function formatVpnProvider(p: VpnProviderProfile): string {
  const lines = [
    `# ${p.name}`,
    `**Provider:** ${p.provider}`,
    `**API Available:** ${p.apiAvailable ? "✅ Yes" : "❌ No"}`,
    p.apiEndpoint ? `**API Endpoint:** ${p.apiEndpoint}` : "",
    `**Logging Policy:** ${p.loggingPolicy}`,
    `**Jurisdictions:** ${p.jurisdictions.join(", ")}`,
    ``,
    `## Protocols`,
    p.protocols.map((pr) => `- ${pr}`).join("\n"),
    ``,
    `## Features`,
    p.features.map((f) => `- ✅ ${f}`).join("\n"),
    ``,
    `## Capabilities`,
    `- Kill Switch: ${p.killSwitchSupport ? "✅" : "❌"}`,
    `- Multi-hop: ${p.multihopSupport ? "✅" : "❌"}`,
    `- Port Forwarding: ${p.portForwardingSupport ? "✅" : "❌"}`,
  ].filter(Boolean);
  if (p.integrationNotes.length > 0) {
    lines.push(``, `## Integration Notes`, p.integrationNotes.map((n) => `- ${n}`).join("\n"));
  }
  if (p.automationCapabilities.length > 0) {
    lines.push(``, `## Automation Capabilities`, p.automationCapabilities.map((c) => `- ⚙️ ${c}`).join("\n"));
  }
  return lines.join("\n");
}

export const DEFAULT_CREDS = [
  { service: "Apache Tomcat", username: "admin", password: "admin", risk: "critical" },
  { service: "Apache Tomcat", username: "tomcat", password: "tomcat", risk: "critical" },
  { service: "Jenkins", username: "admin", password: "admin", risk: "critical" },
  { service: "Grafana", username: "admin", password: "admin", risk: "critical" },
  { service: "MySQL", username: "root", password: "", risk: "critical" },
  { service: "PostgreSQL", username: "postgres", password: "postgres", risk: "critical" },
  { service: "MongoDB", username: "admin", password: "admin", risk: "critical" },
  { service: "Redis", username: "", password: "", risk: "critical" },
  { service: "Elastic Kibana", username: "elastic", password: "changeme", risk: "critical" },
  { service: "Cisco IOS", username: "admin", password: "cisco", risk: "critical" },
  { service: "WordPress", username: "admin", password: "admin", risk: "high" },
  { service: "Drupal", username: "admin", password: "admin", risk: "high" },
  { service: "D-Link Router", username: "admin", password: "", risk: "critical" },
  { service: "Netgear Router", username: "admin", password: "password", risk: "critical" },
  { service: "TP-Link Router", username: "admin", password: "admin", risk: "critical" },
];

export function formatPasswordAttackTechnique(t: PasswordAttackTechnique): string {
  return [
    `## ${t.name}`,
    `**Category:** ${t.category}`,
    `**OWASP:** ${t.owasp}`,
    ``,
    t.description,
    ``,
    `**Tools:** ${t.tools.join(", ")}`,
    ``,
    `**Commands:**`,
    "\`\`\`bash",
    ...t.commands,
    "\`\`\`",
    ``,
    `**Defenses Bypassed:** ${t.defensesBypass}`,
    `**Mitigation:** ${t.mitigation}`,
  ].join("\n");
}
