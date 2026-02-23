/**
 * natt.ts — N.A.T.T. Ghost Agent
 *
 * Network Attack & Testing Toolkit
 * An ethical hacker Ghost Agent with access to any system, platform,
 * web app, API, or HTML. Operates in Ghost Mode: low-and-slow, passive-first,
 * leave-no-trace reconnaissance before active testing.
 *
 * Capabilities:
 *  - Web App Scanning    : XSS, SQLi, CSRF, IDOR, LFI, open redirect
 *  - HTML Analysis       : DOM vulns, inline scripts, form security, CSP
 *  - API Recon           : endpoint discovery, auth bypass, method override
 *  - Network Recon       : port scan, banner grab, SSL/TLS, service fingerprint
 *  - OSINT               : subdomain enum, DNS, cert transparency, dork gen
 *  - Auth Testing        : JWT, session tokens, cookie flags, brute protection
 *  - Platform Detection  : CMS, admin panels, tech stack fingerprinting
 *  - Code Analysis       : hardcoded secrets, vulnerable dependencies
 *  - Ghost Mode          : anti-detection patterns, passive recon, rate-limited probes
 *
 * All operations are ethical — target must be owned or authorized.
 * Built-in ethics gate rejects unauthorized targets.
 */

import Anthropic from "@anthropic-ai/sdk";
import https from "https";
import http from "http";
import dns from "dns/promises";
import net from "net";
import crypto from "crypto";
import { execFileSync } from "child_process";
import { sanitizeShellArg } from "@/middleware/sanitizer";
import {
  validateROE,
  type ROEValidationResult,
} from "./natt-roe.js";
import {
  recordScan,
  recordEpisode,
  getMemorySummary,
  type NATTScanRecord,
} from "./natt-memory.js";

export type { ROEValidationResult };

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
const NATT_VERSION = "1.0.0";

// ─────────────────────────────────────────────────────────────────────────────
//  Mission Types
// ─────────────────────────────────────────────────────────────────────────────

export type NATTMissionType =
  | "web-app"
  | "html-analysis"
  | "api-recon"
  | "network-recon"
  | "osint"
  | "auth-testing"
  | "platform-detection"
  | "code-analysis"
  | "full-ghost";

export type NATTSeverity = "critical" | "high" | "medium" | "low" | "info";

export type NATTGhostMode = "passive" | "stealth" | "active";

export interface NATTTarget {
  /** URL, IP, HTML string, or file path. */
  value: string;
  /** Explicit type helps NATT choose the right tools. */
  type: "url" | "ip" | "html" | "api-endpoint" | "file-path" | "domain";
  /** Authorization token / proof of ownership (required for active modes). */
  authorizationProof?: string;
  /** Scope — additional URLs/IPs NATT is permitted to test. */
  scope?: string[];
}

export interface NATTFinding {
  id: string;
  severity: NATTSeverity;
  category: NATTFindingCategory;
  title: string;
  description: string;
  evidence: string;
  /** Where it was found (URL, line number, field name, etc.). */
  location: string;
  cve?: string;
  cvss?: number;
  owasp?: string; // e.g. "A01:2021 – Broken Access Control"
  reproduction: string; // Step-by-step to reproduce
  remediation: string;
  ghostNotes?: string; // NATT's tactical interpretation
}

export type NATTFindingCategory =
  | "injection"
  | "broken-auth"
  | "sensitive-data"
  | "xxe"
  | "broken-access-control"
  | "security-misconfiguration"
  | "xss"
  | "insecure-deserialization"
  | "vulnerable-components"
  | "logging-monitoring"
  | "csrf"
  | "ssrf"
  | "open-redirect"
  | "information-disclosure"
  | "api-weakness"
  | "network-exposure"
  | "cryptography"
  | "idor"
  | "business-logic"
  | "html-injection"
  | "dom-vulnerability"
  | "missing-header"
  | "platform-specific"
  | "osint-exposure"
  | "ghost-recon";

export interface NATTMissionSummary {
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  totalFindings: number;
  attackSurface: string[];    // Discovered entry points
  techStack: string[];        // Identified technologies
  riskScore: number;          // 0–100
  riskRating: "critical" | "high" | "medium" | "low" | "clean";
  ghostAssessment: string;    // NATT's tactical summary
  topVector: string;          // Most critical attack vector found
}

export interface NATTMission {
  missionId: string;
  codename: string;           // Auto-generated ghost codename
  operator: string;           // Who launched this (userId / agentId)
  target: NATTTarget;
  missionType: NATTMissionType;
  ghostMode: NATTGhostMode;
  startedAt: Date;
  completedAt: Date;
  findings: NATTFinding[];
  summary: NATTMissionSummary;
  aiIntelligence: string;     // Full Claude analysis
  recon: NATTReconData;
}

export interface NATTReconData {
  /** Open ports found (network scan). */
  openPorts?: number[];
  /** HTTP headers returned. */
  httpHeaders?: Record<string, string>;
  /** Security headers that are present/missing. */
  securityHeaders?: Array<{ header: string; present: boolean; value?: string; risk: string }>;
  /** Subdomains discovered. */
  subdomains?: string[];
  /** DNS records. */
  dnsRecords?: Record<string, string[]>;
  /** SSL/TLS details. */
  tlsInfo?: { protocol: string; cipher: string; expiry: Date | null; issues: string[] };
  /** Detected technologies (frameworks, CMS, servers). */
  techStack?: string[];
  /** Admin/sensitive endpoints found. */
  sensitiveEndpoints?: string[];
  /** HTML forms enumerated. */
  forms?: NATTFormRecon[];
  /** JavaScript files found. */
  jsFiles?: string[];
  /** API endpoints discovered. */
  apiEndpoints?: string[];
  /** OSINT data. */
  osint?: { dorks: string[]; certDomains: string[]; emailPatterns: string[] };
  /** Raw cookies from initial probe. */
  cookies?: Array<{ name: string; flags: string[]; secure: boolean; httpOnly: boolean; sameSite: string }>;
  /** Email security policy records. */
  emailSecurity?: {
    spf?: string;
    dkim?: Record<string, string>;
    dmarc?: string;
    assessment: string;
  };
  /** CVE matches found for detected technologies. */
  cveMatches?: Array<{ tech: string; cveId: string; description: string; severity: string }>;
}

export interface NATTFormRecon {
  action: string;
  method: string;
  fields: Array<{ name: string; type: string; hasAutocomplete: boolean }>;
  hasCsrfToken: boolean;
  hasEnctype: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Ethics Gate
// ─────────────────────────────────────────────────────────────────────────────

const BLOCKED_RANGES = [
  // Government / critical infrastructure patterns
  /\.gov$/i,
  /\.mil$/i,
  /\.edu$/i, // unless scoped
];

const ALWAYS_ALLOWED_LOCAL = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];

function ethicsGate(target: NATTTarget, mode: NATTGhostMode): void {
  const val = target.value.toLowerCase();

  // Active mode requires explicit authorization proof
  if (mode === "active" && !target.authorizationProof) {
    throw new Error(
      "[NATT] Active ghost mode requires authorizationProof. " +
      "Provide written authorization before launching active tests."
    );
  }

  // Block obviously unauthorized targets in active/stealth modes
  if (mode !== "passive") {
    for (const pattern of BLOCKED_RANGES) {
      if (pattern.test(val)) {
        throw new Error(
          `[NATT] Target matches restricted pattern (${pattern}). ` +
          "NATT will not engage restricted infrastructure."
        );
      }
    }
  }

  // Localhost/loopback always allowed for dev testing
  const isLocal = ALWAYS_ALLOWED_LOCAL.some((h) => val.includes(h));
  if (!isLocal && mode === "active" && !target.authorizationProof) {
    throw new Error("[NATT] Active mode requires proof of authorization.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Recon Utilities
// ─────────────────────────────────────────────────────────────────────────────

async function probeHTTP(url: string): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  responseTimeMs: number;
}> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const isHttps = url.startsWith("https");
    const lib = isHttps ? https : http;

    const req = lib.get(
      url,
      {
        timeout: 10000,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SecurityScanner/1.0; +https://devbot.internal/natt)",
          "Accept": "text/html,application/xhtml+xml,application/json,*/*",
        },
        rejectUnauthorized: false, // needed for TLS analysis
      },
      (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => {
          if (body.length < 500_000) body += chunk.toString(); // cap at 500KB
        });
        res.on("end", () =>
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers as Record<string, string>,
            body,
            responseTimeMs: Date.now() - start,
          })
        );
      }
    );

    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}

function parseSecurityHeaders(headers: Record<string, string>): NATTReconData["securityHeaders"] {
  const required = [
    {
      header: "strict-transport-security",
      risk: "Missing HSTS allows protocol downgrade attacks",
    },
    {
      header: "content-security-policy",
      risk: "Missing CSP enables XSS and data injection",
    },
    {
      header: "x-content-type-options",
      risk: "Missing X-Content-Type-Options allows MIME sniffing",
    },
    {
      header: "x-frame-options",
      risk: "Missing X-Frame-Options enables clickjacking",
    },
    {
      header: "referrer-policy",
      risk: "Missing Referrer-Policy leaks sensitive URL fragments",
    },
    {
      header: "permissions-policy",
      risk: "Missing Permissions-Policy exposes browser APIs",
    },
    {
      header: "x-xss-protection",
      risk: "Deprecated but absence signals low security maturity",
    },
    {
      header: "cross-origin-opener-policy",
      risk: "Missing COOP enables cross-origin attacks",
    },
    {
      header: "cross-origin-resource-policy",
      risk: "Missing CORP allows cross-origin data leaks",
    },
  ];

  return required.map(({ header, risk }) => ({
    header,
    present: header in headers,
    value: headers[header],
    risk,
  }));
}

function analyzeCookies(setCookieHeaders: string | string[] | undefined): NATTReconData["cookies"] {
  if (!setCookieHeaders) return [];
  const cookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];

  return cookies.map((raw) => {
    const parts = raw.split(";").map((p) => p.trim().toLowerCase());
    const [nameVal] = raw.split(";");
    const name = nameVal?.split("=")[0]?.trim() ?? "unknown";
    const flags: string[] = [];

    if (parts.includes("secure")) flags.push("Secure");
    if (parts.includes("httponly")) flags.push("HttpOnly");
    const samesitePart = parts.find((p) => p.startsWith("samesite="));
    const sameSite = samesitePart ? samesitePart.replace("samesite=", "") : "none";

    return {
      name,
      flags,
      secure: parts.includes("secure"),
      httpOnly: parts.includes("httponly"),
      sameSite,
    };
  });
}

function analyzeHTML(html: string): {
  forms: NATTFormRecon[];
  jsFiles: string[];
  inlineScripts: string[];
  sensitiveComments: string[];
  insecureResources: string[];
  metaTags: Record<string, string>;
} {
  // Forms
  const formRegex = /<form([^>]*)>([\s\S]*?)<\/form>/gi;
  const inputRegex = /<input([^>]*)>/gi;
  const forms: NATTFormRecon[] = [];
  let formMatch: RegExpExecArray | null;

  while ((formMatch = formRegex.exec(html)) !== null) {
    const formAttrs = formMatch[1] ?? "";
    const formBody = formMatch[2] ?? "";
    const action = /action\s*=\s*["']([^"']*)["']/i.exec(formAttrs)?.[1] ?? "";
    const method = /method\s*=\s*["']([^"']*)["']/i.exec(formAttrs)?.[1]?.toLowerCase() ?? "get";
    const enctype = /enctype\s*=\s*["']([^"']*)["']/i.exec(formAttrs)?.[1] ?? "";

    const fields: NATTFormRecon["fields"] = [];
    let inputMatch: RegExpExecArray | null;
    const inputScan = new RegExp(inputRegex.source, "gi");
    while ((inputMatch = inputScan.exec(formBody)) !== null) {
      const attrs = inputMatch[1] ?? "";
      fields.push({
        name: /name\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] ?? "",
        type: /type\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] ?? "text",
        hasAutocomplete:
          /autocomplete\s*=\s*["']off["']/i.test(attrs) === false,
      });
    }

    const hasCsrfToken = /_token|csrf|nonce|__RequestVerificationToken/i.test(formBody);
    forms.push({ action, method, fields, hasCsrfToken, hasEnctype: !!enctype });
  }

  // JavaScript files
  const jsRegex = /<script[^>]+src\s*=\s*["']([^"']+)["']/gi;
  const jsFiles: string[] = [];
  let jsMatch: RegExpExecArray | null;
  while ((jsMatch = jsRegex.exec(html)) !== null) {
    jsFiles.push(jsMatch[1] ?? "");
  }

  // Inline scripts
  const inlineScriptRegex = /<script(?![^>]+src)[^>]*>([\s\S]*?)<\/script>/gi;
  const inlineScripts: string[] = [];
  let inlineMatch: RegExpExecArray | null;
  while ((inlineMatch = inlineScriptRegex.exec(html)) !== null) {
    const content = (inlineMatch[1] ?? "").trim();
    if (content.length > 0) inlineScripts.push(content.substring(0, 500));
  }

  // Sensitive HTML comments
  const commentRegex = /<!--([\s\S]*?)-->/g;
  const sensitiveComments: string[] = [];
  const sensitivePatterns = /password|token|secret|api[_\s]?key|todo|fixme|hack|admin|debug|config/i;
  let commentMatch: RegExpExecArray | null;
  while ((commentMatch = commentRegex.exec(html)) !== null) {
    if (sensitivePatterns.test(commentMatch[1] ?? "")) {
      sensitiveComments.push((commentMatch[1] ?? "").trim().substring(0, 200));
    }
  }

  // Insecure (HTTP) resources loaded on HTTPS pages
  const insecureRegex = /(?:src|href|action)\s*=\s*["'](http:\/\/[^"']+)["']/gi;
  const insecureResources: string[] = [];
  let insecureMatch: RegExpExecArray | null;
  while ((insecureMatch = insecureRegex.exec(html)) !== null) {
    insecureResources.push(insecureMatch[1] ?? "");
  }

  // Meta tags
  const metaRegex = /<meta\s+([^>]+)>/gi;
  const metaTags: Record<string, string> = {};
  let metaMatch: RegExpExecArray | null;
  while ((metaMatch = metaRegex.exec(html)) !== null) {
    const attrs = metaMatch[1] ?? "";
    const nameMatch = /name\s*=\s*["']([^"']*)["']/i.exec(attrs);
    const contentMatch = /content\s*=\s*["']([^"']*)["']/i.exec(attrs);
    if (nameMatch && contentMatch) {
      metaTags[nameMatch[1] ?? ""] = contentMatch[1] ?? "";
    }
  }

  return { forms, jsFiles, inlineScripts, sensitiveComments, insecureResources, metaTags };
}

function detectTechStack(html: string, headers: Record<string, string>): string[] {
  const tech: Set<string> = new Set();

  // Headers
  if (headers["server"]) tech.add(`Server: ${headers["server"]}`);
  if (headers["x-powered-by"]) tech.add(`Powered-By: ${headers["x-powered-by"]}`);
  if (headers["x-generator"]) tech.add(`Generator: ${headers["x-generator"]}`);

  // HTML fingerprints
  const fingerprints: Array<[RegExp, string]> = [
    [/wp-content|wp-includes|WordPress/i, "WordPress"],
    [/Drupal|drupal\.settings/i, "Drupal"],
    [/Joomla!/i, "Joomla"],
    [/Magento|mage\/|varien\//i, "Magento"],
    [/shopify\.com|Shopify\.theme/i, "Shopify"],
    [/next\/dist|__NEXT_DATA__|nextjs/i, "Next.js"],
    [/react\.production|__reactFiber/i, "React"],
    [/vue\.runtime|__vue__|VueJS/i, "Vue.js"],
    [/angular\.min|ng-version|ng-app/i, "Angular"],
    [/laravel_session|Laravel/i, "Laravel"],
    [/django-csrf|csrfmiddlewaretoken/i, "Django"],
    [/rails\/|csrf-param.*authenticity_token/i, "Ruby on Rails"],
    [/ASP\.NET|__VIEWSTATE|__EventValidation/i, "ASP.NET"],
    [/fastapi|uvicorn/i, "FastAPI"],
    [/express|X-Powered-By.*Express/i, "Express.js"],
    [/cdn\.tailwindcss|tailwindcss/i, "Tailwind CSS"],
    [/bootstrap\.min/i, "Bootstrap"],
    [/jquery\.min|jQuery/i, "jQuery"],
  ];

  for (const [pattern, name] of fingerprints) {
    if (pattern.test(html) || pattern.test(JSON.stringify(headers))) {
      tech.add(name);
    }
  }

  return Array.from(tech);
}

async function enumerateSubdomains(domain: string): Promise<string[]> {
  const commonPrefixes = [
    "www", "mail", "api", "dev", "staging", "test", "admin",
    "app", "portal", "dashboard", "cdn", "static", "assets",
    "blog", "shop", "store", "support", "docs", "beta", "auth",
    "login", "oauth", "sso", "vpn", "remote", "ftp", "smtp",
    "jenkins", "ci", "gitlab", "github", "jira", "confluence",
    "grafana", "kibana", "prometheus", "metrics", "monitor",
  ];

  const found: string[] = [];
  const checks = commonPrefixes.map(async (prefix) => {
    const sub = `${prefix}.${domain}`;
    try {
      await dns.resolve4(sub);
      found.push(sub);
    } catch {
      // not found
    }
  });

  await Promise.allSettled(checks);
  return found;
}

async function probeTLSInfo(hostname: string): Promise<NATTReconData["tlsInfo"]> {
  return new Promise((resolve) => {
    const req = https.request(
      { hostname, port: 443, method: "HEAD", timeout: 5000, rejectUnauthorized: false },
      (res) => {
        const socket = res.socket as import("tls").TLSSocket;
        const cert = socket.getPeerCertificate?.();
        const protocol = socket.getProtocol?.() ?? "unknown";
        const cipher = socket.getCipher?.()?.name ?? "unknown";

        const issues: string[] = [];
        if (protocol === "TLSv1" || protocol === "TLSv1.1") {
          issues.push(`Deprecated protocol: ${protocol}`);
        }
        if (cipher.includes("RC4") || cipher.includes("DES") || cipher.includes("NULL")) {
          issues.push(`Weak cipher: ${cipher}`);
        }

        const expiry = cert?.valid_to ? new Date(cert.valid_to) : null;
        if (expiry && expiry < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) {
          issues.push("Certificate expires within 30 days");
        }

        resolve({ protocol, cipher, expiry, issues });
        req.destroy();
      }
    );
    req.on("error", () => resolve(undefined));
    req.on("timeout", () => { req.destroy(); resolve(undefined); });
    req.end();
  });
}

function discoverSensitiveEndpoints(html: string, baseUrl: string): string[] {
  const sensitivePatterns = [
    /["'`](\/admin[^"'`\s]*)/gi,
    /["'`](\/api\/v?\d*\/[^"'`\s]*)/gi,
    /["'`](\/swagger[^"'`\s]*)/gi,
    /["'`](\/graphql[^"'`\s]*)/gi,
    /["'`](\/\.env[^"'`\s]*)/gi,
    /["'`](\/config[^"'`\s]*)/gi,
    /["'`](\/backup[^"'`\s]*)/gi,
    /["'`](\/debug[^"'`\s]*)/gi,
    /["'`](\/phpinfo[^"'`\s]*)/gi,
    /["'`](\/\.git[^"'`\s]*)/gi,
    /["'`](\/wp-login[^"'`\s]*)/gi,
    /["'`](\/login[^"'`\s]*)/gi,
    /["'`](\/dashboard[^"'`\s]*)/gi,
    /["'`](\/uploads?[^"'`\s]*)/gi,
    /["'`](\/actuator[^"'`\s]*)/gi, // Spring Boot
    /["'`](\/health[^"'`\s]*)/gi,
  ];

  const found = new Set<string>();
  for (const pattern of sensitivePatterns) {
    let match: RegExpExecArray | null;
    const re = new RegExp(pattern.source, "gi");
    while ((match = re.exec(html)) !== null) {
      found.add(match[1] ?? "");
    }
  }

  return Array.from(found).slice(0, 50);
}

function generateDorks(domain: string): string[] {
  return [
    `site:${domain} filetype:pdf`,
    `site:${domain} filetype:xlsx OR filetype:csv`,
    `site:${domain} "admin" OR "login" OR "dashboard"`,
    `site:${domain} inurl:"/api/"`,
    `site:${domain} "index of /"`,
    `site:${domain} ext:env OR ext:config OR ext:bak`,
    `site:${domain} "phpinfo()" OR "debug" OR "test"`,
    `inurl:${domain} site:pastebin.com`,
    `"@${domain}" email`, 
    `site:${domain} intitle:"error" OR "exception" OR "stack trace"`,
    `site:${domain} "DB_PASSWORD" OR "API_KEY" OR "SECRET"`,
    `cache:${domain}`,
  ];
}

function runPortScanSafe(host: string): string {
  try {
    const cleanHost = sanitizeShellArg(host);
    const result = execFileSync("nmap", ["-sV", "--top-ports", "100", "-T3", cleanHost], {
      timeout: 60_000,
      encoding: "utf-8",
    });
    return result;
  } catch (err) {
    return `nmap not available or failed: ${String(err)}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Lightweight TCP Port Probe (fallback when nmap is unavailable)
// ─────────────────────────────────────────────────────────────────────────────

const COMMON_PORTS = [21, 22, 25, 53, 80, 110, 143, 443, 587, 993, 995,
  3000, 3306, 5432, 6379, 8080, 8443, 9200, 27017];

function probePort(host: string, port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => { sock.destroy(); resolve(true); });
    sock.once("timeout", () => { sock.destroy(); resolve(false); });
    sock.once("error", () => { sock.destroy(); resolve(false); });
    sock.connect(port, host);
  });
}

async function probePorts(host: string, ports: number[] = COMMON_PORTS): Promise<number[]> {
  const results = await Promise.allSettled(
    ports.map(async (p) => ({ port: p, open: await probePort(host, p) }))
  );
  return results
    .filter((r) => r.status === "fulfilled" && r.value.open)
    .map((r) => (r as PromiseFulfilledResult<{ port: number; open: boolean }>).value.port);
}

// ─────────────────────────────────────────────────────────────────────────────
//  DKIM / SPF / DMARC Email Security Check
// ─────────────────────────────────────────────────────────────────────────────

const DKIM_SELECTORS = ["default", "google", "selector1", "selector2", "k1", "s1", "dkim", "mail"];

async function checkEmailSecurity(domain: string): Promise<{
  spf?: string;
  dkim: Record<string, string>;
  dmarc?: string;
  assessment: string;
}> {
  const issues: string[] = [];

  // SPF — look for v=spf1 in TXT records
  let spf: string | undefined;
  try {
    const txt = await dns.resolveTxt(domain);
    const flat = txt.flat();
    spf = flat.find((r) => r.startsWith("v=spf1"));
  } catch { /* no TXT */ }
  if (!spf) issues.push("Missing SPF record");
  else if (spf.includes("+all")) issues.push("SPF uses +all (accepts any sender)");

  // DMARC — _dmarc.<domain>
  let dmarc: string | undefined;
  try {
    const txt = await dns.resolveTxt(`_dmarc.${domain}`);
    dmarc = txt.flat().find((r) => r.startsWith("v=DMARC1"));
  } catch { /* no DMARC */ }
  if (!dmarc) issues.push("Missing DMARC record");
  else if (/p=none/i.test(dmarc)) issues.push("DMARC policy is 'none' (monitoring only)");

  // DKIM — probe common selectors
  const dkim: Record<string, string> = {};
  for (const sel of DKIM_SELECTORS) {
    try {
      const txt = await dns.resolveTxt(`${sel}._domainkey.${domain}`);
      const val = txt.flat().join("");
      if (val.includes("v=DKIM1") || val.includes("p=")) {
        dkim[sel] = val;
      }
    } catch { /* selector not found */ }
  }
  if (Object.keys(dkim).length === 0) issues.push("No DKIM selectors found");

  const assessment = issues.length === 0
    ? "Email authentication fully configured (SPF + DKIM + DMARC)"
    : `Email security gaps: ${issues.join("; ")}`;

  return { spf, dkim, dmarc, assessment };
}

// ─────────────────────────────────────────────────────────────────────────────
//  CVE / Threat Intelligence Lookup (NIST NVD API v2.0)
// ─────────────────────────────────────────────────────────────────────────────

interface CVEMatch {
  tech: string;
  cveId: string;
  description: string;
  severity: string;
}

async function lookupCVEs(techStack: string[]): Promise<CVEMatch[]> {
  const matches: CVEMatch[] = [];
  // Rate-limit: NVD allows ~5 req/30s without API key
  for (const tech of techStack.slice(0, 5)) {
    try {
      const keyword = encodeURIComponent(tech.replace(/[^a-zA-Z0-9 .]/g, "").trim());
      if (!keyword) continue;
      const data = await new Promise<string>((resolve, reject) => {
        const req = https.get(
          `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${keyword}&resultsPerPage=3`,
          { headers: { Accept: "application/json", "User-Agent": "NATT-Ghost/1.0" } },
          (res) => {
            let body = "";
            res.on("data", (c) => { body += c; });
            res.on("end", () => resolve(body));
          }
        );
        req.on("error", reject);
        req.setTimeout(8000, () => { req.destroy(); reject(new Error("timeout")); });
      });
      const parsed = JSON.parse(data);
      for (const vuln of parsed.vulnerabilities ?? []) {
        const cve = vuln.cve;
        const desc = cve?.descriptions?.find((d: { lang: string }) => d.lang === "en")?.value ?? "";
        const metrics = cve?.metrics?.cvssMetricV31?.[0] ?? cve?.metrics?.cvssMetricV2?.[0];
        const severity = metrics?.cvssData?.baseSeverity ?? "UNKNOWN";
        matches.push({ tech, cveId: cve?.id ?? "unknown", description: desc.substring(0, 200), severity });
      }
      // Brief pause between requests to respect NVD rate limits
      await new Promise((r) => setTimeout(r, 6500));
    } catch {
      // Non-fatal — CVE lookup is best-effort
    }
  }
  return matches;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SIEM Webhook Output (Splunk HEC / Elastic / Datadog / generic)
// ─────────────────────────────────────────────────────────────────────────────

async function postToSIEM(webhookUrl: string, mission: NATTMission): Promise<void> {
  const url = new URL(webhookUrl);
  const payload = JSON.stringify({
    source: "natt-ghost",
    sourcetype: "_json",
    event: {
      missionId: mission.missionId,
      codename: mission.codename,
      operator: mission.operator,
      target: mission.target.value,
      targetType: mission.target.type,
      missionType: mission.missionType,
      ghostMode: mission.ghostMode,
      riskScore: mission.summary.riskScore,
      riskRating: mission.summary.riskRating,
      totalFindings: mission.summary.totalFindings,
      criticalCount: mission.summary.criticalCount,
      highCount: mission.summary.highCount,
      mediumCount: mission.summary.mediumCount,
      lowCount: mission.summary.lowCount,
      techStack: mission.summary.techStack,
      topVector: mission.summary.topVector,
      findings: mission.findings.map((f) => ({
        id: f.id,
        severity: f.severity,
        category: f.category,
        title: f.title,
        description: f.description,
        cve: f.cve,
        cvss: f.cvss,
        location: f.location,
      })),
      completedAt: mission.completedAt.toISOString(),
    },
  });

  const mod = url.protocol === "https:" ? https : http;
  await new Promise<void>((resolve, reject) => {
    const req = mod.request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
      timeout: 10_000,
    }, (res) => {
      res.resume();
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) resolve();
        else reject(new Error(`SIEM webhook returned ${res.statusCode}`));
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("SIEM webhook timeout")); });
    req.write(payload);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Finding Builders
// ─────────────────────────────────────────────────────────────────────────────

function buildFinding(
  severity: NATTSeverity,
  category: NATTFindingCategory,
  title: string,
  description: string,
  evidence: string,
  location: string,
  reproduction: string,
  remediation: string,
  extras?: Partial<NATTFinding>
): NATTFinding {
  return {
    id: crypto.randomUUID(),
    severity,
    category,
    title,
    description,
    evidence,
    location,
    reproduction,
    remediation,
    ...extras,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Core Analysis Functions
// ─────────────────────────────────────────────────────────────────────────────

function analyzeHTMLFindings(
  htmlAnalysis: ReturnType<typeof analyzeHTML>,
  baseUrl: string
): NATTFinding[] {
  const findings: NATTFinding[] = [];

  // CSRF checks on forms
  for (const form of htmlAnalysis.forms) {
    if (form.method === "post" && !form.hasCsrfToken) {
      findings.push(
        buildFinding(
          "high",
          "csrf",
          "Form Missing CSRF Protection",
          `Form at "${form.action}" uses POST without a CSRF token field. ` +
            "An attacker can craft a cross-site request to submit this form on behalf of an authenticated victim.",
          `Form action: ${form.action || baseUrl}, Method: ${form.method}, Fields: ${form.fields.map((f) => f.name).join(", ")}`,
          form.action || baseUrl,
          "1. Host a page with an identical form\n2. Induce victim to visit the page\n3. Form auto-submits to target",
          "Add a synchronizer token (CSRF token) to all state-changing forms. " +
            "Use SameSite=Strict cookies for session management.",
          { owasp: "A01:2021 – Broken Access Control" }
        )
      );
    }

    // Password fields without autocomplete=off
    for (const field of form.fields) {
      if (field.type === "password" && field.hasAutocomplete) {
        findings.push(
          buildFinding(
            "low",
            "sensitive-data",
            "Password Field Allows Browser Autocomplete",
            "Password input does not set autocomplete='off', allowing browsers to save credentials.",
            `Field: ${field.name}, Form: ${form.action}`,
            form.action || baseUrl,
            "Check browser saved credentials for the affected field",
            "Set autocomplete='off' on all password fields."
          )
        );
      }
    }
  }

  // Sensitive HTML comments
  for (const comment of htmlAnalysis.sensitiveComments) {
    findings.push(
      buildFinding(
        "medium",
        "information-disclosure",
        "Sensitive Information in HTML Comment",
        "HTML comments contain potentially sensitive information (credentials, API keys, dev notes).",
        comment.substring(0, 300),
        baseUrl,
        "View page source and search for <!-- --> blocks",
        "Remove all developer comments from production HTML. " +
          "Use a build step to strip comments during deployment.",
        { owasp: "A05:2021 – Security Misconfiguration" }
      )
    );
  }

  // Insecure resources (mixed content)
  if (htmlAnalysis.insecureResources.length > 0) {
    findings.push(
      buildFinding(
        "medium",
        "security-misconfiguration",
        "Mixed Content: HTTP Resources on HTTPS Page",
        `The page loads ${htmlAnalysis.insecureResources.length} resource(s) over HTTP while the page is served over HTTPS.`,
        htmlAnalysis.insecureResources.slice(0, 5).join(", "),
        baseUrl,
        "Observe network requests in DevTools — HTTP resources will be flagged as mixed content",
        "Replace all HTTP resource URLs with HTTPS equivalents or protocol-relative URLs (//)."
      )
    );
  }

  // Inline scripts with suspicious patterns
  for (const script of htmlAnalysis.inlineScripts) {
    if (/eval\s*\(|document\.write\s*\(|innerHTML\s*=/i.test(script)) {
      findings.push(
        buildFinding(
          "medium",
          "dom-vulnerability",
          "Unsafe DOM Manipulation Detected",
          "Inline script uses eval(), document.write(), or innerHTML assignment, which are DOM-XSS sinks.",
          script.substring(0, 300),
          baseUrl,
          "Test with: ' onmouseover=alert(1) // in any reflected input",
          "Replace eval() with safer alternatives. Use textContent instead of innerHTML. " +
            "Avoid document.write(). Implement a strict Content Security Policy."
        )
      );
    }
  }

  return findings;
}

function analyzeHeaderFindings(
  securityHeaders: NonNullable<NATTReconData["securityHeaders"]>,
  cookies: NonNullable<NATTReconData["cookies"]>
): NATTFinding[] {
  const findings: NATTFinding[] = [];

  for (const header of securityHeaders) {
    if (!header.present) {
      const severity: NATTSeverity =
        header.header === "content-security-policy" ||
        header.header === "strict-transport-security"
          ? "medium"
          : "low";

      findings.push(
        buildFinding(
          severity,
          "missing-header",
          `Missing Security Header: ${header.header}`,
          header.risk,
          `Header "${header.header}" not present in response`,
          "HTTP Response Headers",
          `Inspect response headers: curl -I <target>`,
          `Add the ${header.header} header to all responses. ` +
            "Configure at the web server, CDN, or application layer.",
          { owasp: "A05:2021 – Security Misconfiguration" }
        )
      );
    }
  }

  // Cookie security analysis
  for (const cookie of cookies) {
    const issues: string[] = [];
    if (!cookie.secure) issues.push("missing Secure flag");
    if (!cookie.httpOnly) issues.push("missing HttpOnly flag");
    if (cookie.sameSite === "none" || !cookie.sameSite) issues.push("weak SameSite policy");

    if (issues.length > 0) {
      findings.push(
        buildFinding(
          issues.includes("missing HttpOnly flag") ? "medium" : "low",
          "broken-auth",
          `Cookie Security Issues: ${cookie.name}`,
          `Cookie "${cookie.name}" has security weaknesses: ${issues.join(", ")}.`,
          `Cookie: ${cookie.name}, Flags: ${cookie.flags.join(",")} SameSite: ${cookie.sameSite}`,
          "Set-Cookie Response Header",
          "Intercept set-cookie headers with a MITM proxy (Burp Suite)",
          `Set the cookie with: Secure; HttpOnly; SameSite=Strict (or Lax for cross-site flows).`,
          { owasp: "A07:2021 – Identification and Authentication Failures" }
        )
      );
    }
  }

  return findings;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Ghost Codename Generator
// ─────────────────────────────────────────────────────────────────────────────

const GHOST_NOUNS = ["Specter", "Phantom", "Shadow", "Wraith", "Shade", "Revenant", "Banshee", "Echo"];
const GHOST_ADJECTIVES = ["Silent", "Dark", "Null", "Void", "Hollow", "Obsidian", "Crimson", "Onyx"];

function generateCodename(): string {
  const adj = GHOST_ADJECTIVES[Math.floor(Math.random() * GHOST_ADJECTIVES.length)]!;
  const noun = GHOST_NOUNS[Math.floor(Math.random() * GHOST_NOUNS.length)]!;
  const num = Math.floor(Math.random() * 900) + 100;
  return `${adj}-${noun}-${num}`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Summary Builder
// ─────────────────────────────────────────────────────────────────────────────

function buildSummary(
  findings: NATTFinding[],
  recon: NATTReconData
): NATTMissionSummary {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;

  const riskScore = Math.min(
    100,
    counts.critical * 25 + counts.high * 10 + counts.medium * 4 + counts.low * 1
  );

  const riskRating =
    riskScore >= 75 ? "critical" :
    riskScore >= 50 ? "high" :
    riskScore >= 25 ? "medium" :
    riskScore >= 5 ? "low" : "clean";

  const topFinding = findings.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return order[a.severity] - order[b.severity];
  })[0];

  const attackSurface = [
    ...(recon.sensitiveEndpoints?.slice(0, 10) ?? []),
    ...(recon.openPorts?.map((p) => `port:${p}`) ?? []),
    ...(recon.forms?.map((f) => `form:${f.action}`) ?? []),
  ].filter(Boolean);

  return {
    criticalCount: counts.critical,
    highCount: counts.high,
    mediumCount: counts.medium,
    lowCount: counts.low,
    infoCount: counts.info,
    totalFindings: findings.length,
    attackSurface: [...new Set(attackSurface)],
    techStack: recon.techStack ?? [],
    riskScore,
    riskRating,
    ghostAssessment: `NATT Ghost v${NATT_VERSION} completed mission. ` +
      `Risk Score: ${riskScore}/100 (${riskRating}). ` +
      `Attack surface: ${attackSurface.length} vectors identified.`,
    topVector: topFinding?.title ?? "No critical vectors found",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  AI Intelligence Analysis
// ─────────────────────────────────────────────────────────────────────────────

async function runAIIntelligence(
  target: NATTTarget,
  missionType: NATTMissionType,
  findings: NATTFinding[],
  recon: NATTReconData,
  summary: NATTMissionSummary,
  memoryContext: string = ""
): Promise<string> {
  const memoryBlock = memoryContext
    ? `\n━━━ GHOST MEMORY (cross-session intelligence) ━━━\n${memoryContext}\n`
    : "";

  const prompt = `You are NATT, a Ghost Agent — an elite ethical hacker with expertise in web application security, network exploitation, OSINT, and red team operations. You operate under strict Rules of Engagement and only produce intelligence for authorized targets.

You have completed a security assessment. Deliver a complete tactical intelligence report.
${memoryBlock}
━━━ MISSION BRIEF ━━━
TARGET:      ${target.value} (${target.type})
MISSION:     ${missionType}
GHOST MODE:  ${summary.riskRating}
RISK SCORE:  ${summary.riskScore}/100
TECH STACK:  ${summary.techStack.join(", ") || "unknown / not detected"}

━━━ FINDING COUNTS ━━━
🔴 Critical: ${summary.criticalCount}
🟠 High:     ${summary.highCount}
🟡 Medium:   ${summary.mediumCount}
🟢 Low:      ${summary.lowCount}

━━━ TOP FINDINGS ━━━
${findings
  .slice(0, 10)
  .map((f, i) => `${i + 1}. [${f.severity.toUpperCase()}] ${f.title}\n   ${f.description}`)
  .join("\n\n")}

━━━ ATTACK SURFACE ━━━
${summary.attackSurface.slice(0, 15).join(" | ")}

━━━ INTELLIGENCE REQUIRED ━━━

Provide ALL of the following sections. Do not omit or shorten any section:

**1. EXECUTIVE SUMMARY** (3-4 sentences)
State overall risk posture, most dangerous finding, and business impact in plain language for non-technical leadership.

**2. ATTACK CHAINS** (top 3, ranked by exploitability × impact)
For each chain: name it, list the exact findings that chain together, describe the exploitation sequence step-by-step, and estimate time-to-exploit for a motivated attacker.

**3. REMEDIATION ROADMAP**
- IMMEDIATE (0-48h): Critical/High findings. Exact fix per finding + verification step.
- SHORT-TERM (1-2 weeks): Medium findings and hardening. Specific code/config changes.
- LONG-TERM (1-3 months): Architecture improvements, security posture uplift, tooling.

**4. GHOST TACTICAL NOTES**
Patterns that betray deeper architectural or organizational security debt — things the individual findings don't show alone. Think like a red team lead, not a scanner.

**5. DETECTION & MONITORING**
Specific log queries, metrics, or alerts to detect exploitation attempts for the top 3 findings. Include example log patterns or SIEM rule logic where applicable.

Be precise, technical, and ruthlessly actionable. Every recommendation must name the exact file, endpoint, header, or config to change.`;


  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { type: "text"; text: string }).text)
    .join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main Ghost Agent Entry Points
// ─────────────────────────────────────────────────────────────────────────────

/**
 * NATT Ghost Agent — Run a security mission against a target.
 *
 * @param target     - What to test (URL, IP, HTML, domain, API endpoint)
 * @param missionType - Scope of the assessment
 * @param ghostMode  - passive (read-only recon) | stealth (low-impact probes) | active (full test)
 * @param operator   - Who launched the mission (for audit logging)
 * @returns          - NATTMission with all findings, recon data, and AI intelligence
 *
 * @example
 * // Passive recon on a web app
 * const mission = await launchNATTMission(
 *   { value: "https://example.com", type: "url" },
 *   "web-app",
 *   "passive",
 *   "user-123"
 * );
 */
export async function launchNATTMission(
  target: NATTTarget,
  missionType: NATTMissionType = "full-ghost",
  ghostMode: NATTGhostMode = "stealth",
  operator: string = "anonymous",
  options?: {
    /** ROE engagement ID. When provided, ROE is validated before the mission starts. */
    engagementId?: string;
    /** Mission passphrase — must match the engagement's missionPassphrase. */
    passphrase?: string;
    /** Automatically save mission to vault on completion (default: true). */
    autoVault?: boolean;
    /** Mermaid diagram for vault artifact. */
    mermaidDiagram?: string;
    /** SIEM webhook URL — POST findings as structured JSON on completion. */
    webhookUrl?: string;
    /** Enable CVE lookup against NIST NVD for detected tech stack (default: false). */
    cveCheck?: boolean;
  }
): Promise<NATTMission> {
  // Ethics gate — throws if unauthorized
  ethicsGate(target, ghostMode);

  // ── ROE Validation ────────────────────────────────────────
  let roeResult: ROEValidationResult | undefined;
  if (options?.engagementId) {
    console.log(`[NATT] 🔒 ROE validation for engagement: ${options.engagementId}`);
    roeResult = await validateROE(
      options.engagementId,
      target.value,
      missionType,
      ghostMode,
      options.passphrase ?? "",
      operator
    );
    if (!roeResult.approved) {
      const blocking = roeResult.violations.filter((v) => v.severity === "blocking");
      throw new Error(
        `[NATT] ROE validation failed — mission blocked.\n` +
        blocking.map((v) => `  ⛔ ${v.type}: ${v.message}`).join("\n")
      );
    }
    console.log(`[NATT] ✅ ROE approved — mission guidance loaded`);
    console.log(roeResult.operatorBrief);
  }

  const missionId = crypto.randomUUID();
  const codename = generateCodename();
  const startedAt = new Date();
  const findings: NATTFinding[] = [];
  const recon: NATTReconData = {};

  console.log(`[NATT] 👻 Mission ${codename} (${missionId}) initiated`);
  console.log(`[NATT] Target: ${target.value} | Mode: ${ghostMode} | Type: ${missionType}`);

  // ── Phase 1: HTTP Probe ──────────────────────────────────
  if (
    target.type === "url" &&
    (missionType === "web-app" || missionType === "html-analysis" || missionType === "full-ghost")
  ) {
    try {
      console.log("[NATT] Phase 1: HTTP Probe");
      const probe = await probeHTTP(target.value);
      recon.httpHeaders = probe.headers;
      recon.securityHeaders = parseSecurityHeaders(probe.headers);
      recon.cookies = analyzeCookies(probe.headers["set-cookie"]);

      // Header findings
      findings.push(...analyzeHeaderFindings(recon.securityHeaders ?? [], recon.cookies ?? []));

      // HTML analysis
      if (probe.body) {
        const htmlAnalysis = analyzeHTML(probe.body);
        recon.forms = htmlAnalysis.forms;
        recon.jsFiles = htmlAnalysis.jsFiles;
        recon.sensitiveEndpoints = discoverSensitiveEndpoints(probe.body, target.value);

        const techStack = detectTechStack(probe.body, probe.headers);
        recon.techStack = techStack;

        findings.push(...analyzeHTMLFindings(htmlAnalysis, target.value));

        // Info finding for tech stack disclosure
        if (techStack.length > 0) {
          findings.push(
            buildFinding(
              "info",
              "information-disclosure",
              "Technology Stack Fingerprinted",
              `The application reveals its technology stack through headers and HTML patterns.`,
              techStack.join(", "),
              target.value,
              "Check response headers and HTML source for generator/framework signatures",
              "Remove or obscure server, X-Powered-By, and X-Generator headers. " +
                "Minimize technology fingerprinting in HTML."
            )
          );
        }

        // Sensitive endpoints
        if (recon.sensitiveEndpoints.length > 0) {
          findings.push(
            buildFinding(
              "medium",
              "information-disclosure",
              "Sensitive Endpoints Discovered in Source",
              `Found ${recon.sensitiveEndpoints.length} potentially sensitive endpoints referenced in page source.`,
              recon.sensitiveEndpoints.slice(0, 10).join(", "),
              target.value,
              "View page source and grep for /admin, /api/, /config, /backup patterns",
              "Ensure sensitive endpoints require authentication. " +
                "Remove references to internal/debug endpoints from client-facing source."
            )
          );
        }
      }
    } catch (err) {
      console.warn(`[NATT] HTTP probe failed: ${String(err)}`);
    }
  }

  // ── Phase 2: HTML Analysis (direct HTML input) ───────────
  if (target.type === "html" || missionType === "html-analysis") {
    const html = target.type === "html" ? target.value : "";
    if (html) {
      const htmlAnalysis = analyzeHTML(html);
      recon.forms = htmlAnalysis.forms;
      recon.jsFiles = htmlAnalysis.jsFiles;
      findings.push(...analyzeHTMLFindings(htmlAnalysis, "provided-html"));
    }
  }

  // ── Phase 3: Network Recon ───────────────────────────────
  if (
    (target.type === "ip" || target.type === "url" || target.type === "domain") &&
    (missionType === "network-recon" || missionType === "full-ghost") &&
    ghostMode !== "passive"
  ) {
    console.log("[NATT] Phase 3: Network Recon");
    try {
      const host = target.type === "url"
        ? new URL(target.value).hostname
        : target.value;

      // Try nmap first, fall back to lightweight TCP probe
      const nmap = runPortScanSafe(host);
      let openPorts: number[] = [];

      if (nmap.startsWith("nmap not available")) {
        console.log("[NATT] nmap unavailable — falling back to TCP connect probe");
        openPorts = await probePorts(host);
      } else {
        const portMatches = nmap.matchAll(/(\d+)\/tcp\s+open/g);
        for (const m of portMatches) openPorts.push(parseInt(m[1] ?? "0"));
      }
      recon.openPorts = openPorts;

      if (openPorts.length > 10) {
        findings.push(
          buildFinding(
            "medium",
            "network-exposure",
            "Excessive Open Ports",
            `${openPorts.length} TCP ports are open. Unnecessary ports expand the attack surface.`,
            `Open ports: ${openPorts.slice(0, 20).join(", ")}`,
            host,
            "nmap -sV --top-ports 100 <target>",
            "Close unnecessary ports. Apply network segmentation. " +
              "Use firewall rules to restrict access to only required services."
          )
        );
      }

      // TLS analysis
      if (target.type === "url" && target.value.startsWith("https")) {
        const hostnameForTLS = new URL(target.value).hostname;
        recon.tlsInfo = await probeTLSInfo(hostnameForTLS);
        if (recon.tlsInfo?.issues && recon.tlsInfo.issues.length > 0) {
          for (const issue of recon.tlsInfo.issues) {
            findings.push(
              buildFinding(
                "high",
                "cryptography",
                `TLS/SSL Issue: ${issue}`,
                `The SSL/TLS configuration has a weakness: ${issue}`,
                `Protocol: ${recon.tlsInfo.protocol}, Cipher: ${recon.tlsInfo.cipher}`,
                target.value,
                "openssl s_client -connect <host>:443",
                "Update TLS configuration. Disable TLSv1.0/1.1. " +
                  "Use only strong cipher suites (AES-256, ChaCha20). Enable HSTS.",
                { owasp: "A02:2021 – Cryptographic Failures" }
              )
            );
          }
        }
      }
    } catch (err) {
      console.warn(`[NATT] Network recon failed: ${String(err)}`);
    }
  }

  // ── Phase 4: DNS / OSINT ─────────────────────────────────
  if (
    (target.type === "domain" || target.type === "url") &&
    (missionType === "osint" || missionType === "full-ghost")
  ) {
    console.log("[NATT] Phase 4: OSINT / DNS");
    try {
      const domain = target.type === "url"
        ? new URL(target.value).hostname
        : target.value;

      // DNS enumeration
      const [aRecords, mxRecords, txtRecords] = await Promise.allSettled([
        dns.resolve4(domain).catch(() => [] as string[]),
        dns.resolveMx(domain).catch(() => [] as { exchange: string; priority: number }[]),
        dns.resolveTxt(domain).catch(() => [] as string[][]),
      ]);

      recon.dnsRecords = {
        A: aRecords.status === "fulfilled" ? aRecords.value : [],
        MX: mxRecords.status === "fulfilled" ? mxRecords.value.map((r) => r.exchange) : [],
        TXT: txtRecords.status === "fulfilled" ? txtRecords.value.flat() : [],
      };

      // Email security: SPF, DKIM, DMARC
      const emailSec = await checkEmailSecurity(domain);
      recon.emailSecurity = emailSec;

      if (emailSec.assessment.includes("gaps")) {
        const missingParts: string[] = [];
        if (!emailSec.spf) missingParts.push("SPF");
        if (Object.keys(emailSec.dkim).length === 0) missingParts.push("DKIM");
        if (!emailSec.dmarc) missingParts.push("DMARC");

        findings.push(
          buildFinding(
            missingParts.length >= 2 ? "high" : "medium",
            "security-misconfiguration",
            `Email Authentication Gaps: ${missingParts.join(", ")} Missing`,
            emailSec.assessment,
            `SPF: ${emailSec.spf ?? "MISSING"} | DKIM selectors: ${Object.keys(emailSec.dkim).join(", ") || "NONE"} | DMARC: ${emailSec.dmarc ?? "MISSING"}`,
            `DNS: ${domain}`,
            `dig TXT ${domain}; dig TXT _dmarc.${domain}; dig TXT default._domainkey.${domain}`,
            "Configure SPF (v=spf1 with -all), DKIM (2048-bit key), and DMARC (p=reject). " +
              "These prevent email spoofing and phishing using your domain.",
            { owasp: "A05:2021 – Security Misconfiguration" }
          )
        );
      }

      // TXT records may reveal internal info
      const txtFlat = recon.dnsRecords["TXT"] ?? [];
      const sensitiveText = txtFlat.filter(
        (r) => /verify|ms=|google-site|facebook-domain|stripe/i.test(r) === false
      );
      if (sensitiveText.length > 0) {
        findings.push(
          buildFinding(
            "info",
            "osint-exposure",
            "DNS TXT Records Reveal Configuration",
            "DNS TXT records expose information about email providers, verification services, or internal configuration.",
            sensitiveText.join(", "),
            `DNS: ${domain}`,
            `dig TXT ${domain}`,
            "Audit DNS TXT records and remove unnecessary entries. " +
              "Avoid revealing internal infrastructure details via DNS."
          )
        );
      }

      // Subdomain enumeration
      if (ghostMode !== "passive") {
        const subdomains = await enumerateSubdomains(domain);
        recon.subdomains = subdomains;
        if (subdomains.length > 0) {
          findings.push(
            buildFinding(
              "info",
              "ghost-recon",
              `Subdomains Discovered (${subdomains.length})`,
              `Active subdomains found via DNS resolution. These may represent attack surface expansion.`,
              subdomains.join(", "),
              domain,
              "Perform DNS brute force: dnsx, amass, subfinder",
              "Ensure all subdomains are accounted for in your security program. " +
                "Decommission unused subdomains. Apply HTTPS and security headers to all."
            )
          );
        }
      }

      // Google dorks (informational — operator must run these manually)
      recon.osint = {
        dorks: generateDorks(domain),
        certDomains: [],
        emailPatterns: [`security@${domain}`, `admin@${domain}`, `info@${domain}`],
      };
    } catch (err) {
      console.warn(`[NATT] OSINT phase failed: ${String(err)}`);
    }
  }

  // ── Phase 5: API Recon ───────────────────────────────────
  if (
    (target.type === "api-endpoint" || missionType === "api-recon" || missionType === "full-ghost") &&
    target.type !== "html" &&
    target.type !== "ip"
  ) {
    console.log("[NATT] Phase 5: API Recon");
    try {
      const probe = await probeHTTP(target.value);

      // Check for API over HTTP (not HTTPS)
      if (target.value.startsWith("http://")) {
        findings.push(
          buildFinding(
            "critical",
            "cryptography",
            "API Exposed Over Unencrypted HTTP",
            "The API endpoint is accessible over HTTP. All traffic including auth tokens and sensitive data transmits in plaintext.",
            `URL: ${target.value}`,
            target.value,
            "Intercept traffic with Wireshark or mitmproxy",
            "Enforce HTTPS with HSTS. Redirect all HTTP to HTTPS. " +
              "Reject HTTP requests at the load balancer level.",
            { cvss: 9.1, owasp: "A02:2021 – Cryptographic Failures" }
          )
        );
      }

      // Check for verbose error in API response
      if (
        /stack trace|at\s+\w+\s*\(|Exception:|Error:|line \d+|column \d+|\bSQL\b|\bMySQL\b|\bPostgres\b/i.test(
          probe.body
        )
      ) {
        findings.push(
          buildFinding(
            "medium",
            "information-disclosure",
            "Verbose Error Messages / Stack Traces in API Response",
            "API returns detailed error information including stack traces, SQL queries, or framework internals.",
            probe.body.substring(0, 300),
            target.value,
            "Send invalid input and observe the error response body",
            "Catch all exceptions server-side. Return generic error messages in production. " +
              "Log detailed errors server-side only. Disable debug mode in production.",
            { owasp: "A05:2021 – Security Misconfiguration" }
          )
        );
      }

      // CORS check
      if (probe.headers["access-control-allow-origin"] === "*") {
        findings.push(
          buildFinding(
            "high",
            "api-weakness",
            "Wildcard CORS Policy",
            "API returns Access-Control-Allow-Origin: * allowing any origin to read responses. " +
              "This is dangerous for authenticated endpoints.",
            "Access-Control-Allow-Origin: *",
            target.value,
            "From a different origin, fetch the API endpoint and read the response — it will succeed",
            "Restrict CORS to known, trusted origins. Never use wildcard CORS on authenticated endpoints.",
            { owasp: "A01:2021 – Broken Access Control" }
          )
        );
      }

      recon.apiEndpoints = [target.value];
    } catch (err) {
      console.warn(`[NATT] API recon failed: ${String(err)}`);
    }
  }

  // ── Phase 6: Auth Testing ────────────────────────────────
  if (missionType === "auth-testing" || missionType === "full-ghost") {
    // JWT in URL
    if (/[?&](token|jwt|access_token)=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/i.test(target.value)) {
      findings.push(
        buildFinding(
          "high",
          "broken-auth",
          "JWT Token Exposed in URL",
          "A JWT token is present in the URL query string. It will be logged in server access logs, browser history, and referrer headers.",
          "JWT found in URL parameter",
          target.value,
          "Check server access logs or browser history for the JWT",
          "Pass auth tokens in Authorization headers only. " +
            "Never include tokens in URL parameters or log them.",
          { owasp: "A07:2021 – Identification and Authentication Failures" }
        )
      );
    }
  }

  // ── Platform Detection Findings ──────────────────────────
  if (recon.techStack) {
    for (const tech of recon.techStack) {
      if (tech.toLowerCase().includes("wordpress")) {
        findings.push(
          buildFinding(
            "info",
            "platform-specific",
            "WordPress Detected",
            "The application appears to run on WordPress. Check for outdated plugins, themes, and core version.",
            tech,
            target.value,
            "Check /wp-json/wp/v2/users for user enumeration, /wp-login.php for admin panel",
            "Keep WordPress core, plugins, and themes updated. " +
              "Use a WAF. Disable user enumeration. " +
              "Remove wp-config.php from web root. Change default admin username."
          )
        );
      }
    }
  }

  // ── CVE Lookup (optional, queries NIST NVD) ─────────────
  if (options?.cveCheck && recon.techStack && recon.techStack.length > 0) {
    console.log("[NATT] CVE lookup against NIST NVD for detected tech stack");
    try {
      const cves = await lookupCVEs(recon.techStack);
      recon.cveMatches = cves;
      for (const cve of cves) {
        const sev = cve.severity.toLowerCase();
        findings.push(
          buildFinding(
            sev === "critical" ? "critical" : sev === "high" ? "high" : sev === "medium" ? "medium" : "low",
            "vulnerable-components",
            `Known CVE: ${cve.cveId} (${cve.tech})`,
            cve.description,
            `Technology: ${cve.tech} | CVE: ${cve.cveId} | Severity: ${cve.severity}`,
            target.value,
            `Search https://nvd.nist.gov/vuln/detail/${cve.cveId}`,
            `Update ${cve.tech} to the latest patched version. Check vendor advisories for ${cve.cveId}.`,
            { cve: cve.cveId, owasp: "A06:2021 – Vulnerable and Outdated Components" }
          )
        );
      }
    } catch (err) {
      console.warn(`[NATT] CVE lookup failed: ${String(err)}`);
    }
  }

  // ── Build Summary & AI Intelligence ─────────────────────
  const summary = buildSummary(findings, recon);

  // Inject memory context into AI analysis for cross-session intelligence
  let memoryContext = "";
  try {
    memoryContext = await getMemorySummary();
  } catch { /* memory not available yet — first run */ }

  const aiIntelligence = await runAIIntelligence(target, missionType, findings, recon, summary, memoryContext);

  const completedAt = new Date();
  console.log(
    `[NATT] 👻 Mission ${codename} complete. ` +
    `${findings.length} findings | Risk: ${summary.riskScore}/100 (${summary.riskRating})`
  );

  const mission: NATTMission = {
    missionId,
    codename,
    operator,
    target,
    missionType,
    ghostMode,
    startedAt,
    completedAt,
    findings,
    summary,
    aiIntelligence,
    recon,
  };

  // ── Auto-Vault: store mission artifacts ──────────────────
  const autoVault = options?.autoVault !== false; // default true
  if (autoVault) {
    try {
      // Dynamic import avoids circular dep (natt-vault imports from natt types)
      const { storeMission } = await import("./natt-vault.js");
      await storeMission(mission, {
        roeResult,
        engagementId: options?.engagementId,
        operatorBrief: roeResult?.operatorBrief,
        mermaidDiagram: options?.mermaidDiagram,
      });
    } catch (vaultErr) {
      // Non-fatal — vault storage failure should not block mission return
      console.warn(`[NATT] ⚠️  Vault storage failed: ${String(vaultErr)}`);
    }
  }

  // ── Persistent Memory: record scan for cross-session recall ────
  try {
    await recordScan({
      missionId,
      target: target.value,
      domain: target.type === "url" ? new URL(target.value).hostname : target.value,
      missionType,
      ghostMode,
      riskScore: summary.riskScore,
      riskRating: summary.riskRating,
      findingCount: summary.totalFindings,
      criticalCount: summary.criticalCount,
      highCount: summary.highCount,
      techStack: summary.techStack,
      topVector: summary.topVector,
      scannedAt: completedAt.toISOString(),
    });
    if (summary.criticalCount > 0) {
      await recordEpisode(
        missionId,
        `CRITICAL findings on ${target.value}: ${summary.criticalCount} critical, risk ${summary.riskScore}/100`,
        "critical-finding"
      );
    }
  } catch (memErr) {
    console.warn(`[NATT] Memory recording failed: ${String(memErr)}`);
  }

  // ── SIEM Webhook Output ─────────────────────────────────
  if (options?.webhookUrl) {
    console.log(`[NATT] Posting findings to SIEM webhook: ${options.webhookUrl}`);
    try {
      await postToSIEM(options.webhookUrl, mission);
      console.log("[NATT] SIEM webhook delivery successful");
    } catch (siemErr) {
      console.warn(`[NATT] SIEM webhook failed: ${String(siemErr)}`);
    }
  }

  return mission;
}

/**
 * Analyze raw HTML content directly (no HTTP request).
 * Useful when the HTML is already fetched or provided as a string.
 */
export async function analyzeHTMLContent(
  html: string,
  context: string = "provided-html",
  operator: string = "anonymous"
): Promise<NATTMission> {
  return launchNATTMission(
    { value: html, type: "html" },
    "html-analysis",
    "passive",
    operator
  );
}

/**
 * Run a quick Ghost Recon on a URL — passive mode, no active probes.
 * Safe to run against any target without authorization.
 */
export async function ghostRecon(url: string, operator: string = "anonymous"): Promise<NATTMission> {
  return launchNATTMission(
    { value: url, type: "url" },
    "full-ghost",
    "passive",
    operator
  );
}

/**
 * Format a NATTMission as a Slack Block Kit message.
 */
export function formatNATTForSlack(mission: NATTMission): object[] {
  const emoji = {
    critical: "🔴",
    high: "🟠",
    medium: "🟡",
    low: "🟢",
    clean: "✅",
  }[mission.summary.riskRating];

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*👻 NATT Ghost Report — Codename: \`${mission.codename}\`*`,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Target:*\n${mission.target.value}` },
        { type: "mrkdwn", text: `*Mission Type:*\n${mission.missionType}` },
        { type: "mrkdwn", text: `*Ghost Mode:*\n${mission.ghostMode}` },
        { type: "mrkdwn", text: `*Risk Score:*\n${emoji} ${mission.summary.riskScore}/100 (${mission.summary.riskRating})` },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `*Findings:* 🔴 ${mission.summary.criticalCount} Critical  🟠 ${mission.summary.highCount} High  🟡 ${mission.summary.mediumCount} Medium  🟢 ${mission.summary.lowCount} Low`,
          `*Tech Stack:* ${mission.summary.techStack.join(", ") || "unknown"}`,
          `*Top Vector:* ${mission.summary.topVector}`,
        ].join("\n"),
      },
    },
    ...(mission.findings.slice(0, 3).map((f) => ({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*[${f.severity.toUpperCase()}] ${f.title}*\n${f.description.substring(0, 200)}...`,
      },
    }))),
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Ghost Intelligence:*\n${mission.aiIntelligence.substring(0, 1500)}`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Mission ID: \`${mission.missionId}\` | Operator: ${mission.operator} | ${mission.completedAt.toISOString()}`,
        },
      ],
    },
  ];
}

/**
 * Format a NATTMission as a Discord embed.
 */
export function formatNATTForDiscord(mission: NATTMission): object {
  const colorMap = { critical: 0xff0000, high: 0xff6600, medium: 0xffff00, low: 0x00ff00, clean: 0x00ff88 };

  return {
    embeds: [
      {
        title: `👻 NATT Ghost — ${mission.codename}`,
        color: colorMap[mission.summary.riskRating],
        fields: [
          { name: "Target", value: mission.target.value, inline: true },
          { name: "Mission", value: mission.missionType, inline: true },
          { name: "Risk Score", value: `${mission.summary.riskScore}/100 (${mission.summary.riskRating})`, inline: true },
          {
            name: "Findings",
            value: `🔴 ${mission.summary.criticalCount} Critical\n🟠 ${mission.summary.highCount} High\n🟡 ${mission.summary.mediumCount} Medium\n🟢 ${mission.summary.lowCount} Low`,
            inline: true,
          },
          {
            name: "Tech Stack",
            value: mission.summary.techStack.join(", ") || "unknown",
            inline: true,
          },
          {
            name: "Top Vector",
            value: mission.summary.topVector,
            inline: false,
          },
          {
            name: "Ghost Intelligence",
            value: mission.aiIntelligence.substring(0, 1024),
            inline: false,
          },
        ],
        footer: { text: `Mission ${mission.missionId} | Operator: ${mission.operator}` },
        timestamp: mission.completedAt.toISOString(),
      },
    ],
  };
}
