/**
 * natt-skills-mobile.ts — Mobile App API Reconnaissance
 *
 * NATT Expansion Skill: Extracts hardcoded API endpoints, secrets, tokens,
 * and configuration URLs from mobile app assets. Works with:
 *  - Decompiled APK strings (strings.xml, AndroidManifest.xml, smali)
 *  - IPA Info.plist and extracted binaries
 *  - React Native / Flutter bundles (index.android.bundle, etc.)
 *  - Generic binary string dumps
 *
 * Does NOT require the actual APK/IPA — works on extracted text content.
 */

import type {
  NATTFinding,
  NATTSeverity,
} from "./natt.js";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────

export interface MobileReconResult {
  source: string;
  apiEndpoints: ExtractedEndpoint[];
  hardcodedSecrets: ExtractedSecret[];
  configUrls: string[];
  deepLinks: string[];
  findings: NATTFinding[];
  scannedAt: Date;
}

export interface ExtractedEndpoint {
  url: string;
  method?: string;
  context: string; // Surrounding text for analyst review
  isInternal: boolean;
}

export interface ExtractedSecret {
  type: string;
  value: string;
  context: string;
  severity: NATTSeverity;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Pattern Library
// ─────────────────────────────────────────────────────────────────────────────

/** Patterns for extracting API URLs from mobile app content */
const API_URL_PATTERNS: RegExp[] = [
  // Standard API URLs
  /https?:\/\/api\.[a-zA-Z0-9.-]+\.[a-z]{2,}(?:\/[^\s"'<>)}\]]*)?/gi,
  // Versioned API paths
  /https?:\/\/[a-zA-Z0-9.-]+\/(?:api\/)?v[0-9]+(?:\/[^\s"'<>)}\]]*)?/gi,
  // REST-style endpoints
  /https?:\/\/[a-zA-Z0-9.-]+\/(?:graphql|rest|rpc|ws|socket)(?:\/[^\s"'<>)}\]]*)?/gi,
  // Firebase / Google Cloud
  /https?:\/\/[a-zA-Z0-9-]+\.(?:firebaseio\.com|cloudfunctions\.net|googleapis\.com)(?:\/[^\s"'<>)}\]]*)?/gi,
  // AWS API Gateway
  /https?:\/\/[a-z0-9]+\.execute-api\.[a-z0-9-]+\.amazonaws\.com(?:\/[^\s"'<>)}\]]*)?/gi,
  // Supabase
  /https?:\/\/[a-zA-Z0-9]+\.supabase\.co(?:\/[^\s"'<>)}\]]*)?/gi,
];

/** Patterns for extracting hardcoded secrets from mobile content */
const MOBILE_SECRET_PATTERNS: Array<{ name: string; pattern: RegExp; severity: NATTSeverity }> = [
  { name: "Firebase API Key", pattern: /AIzaSy[A-Za-z0-9_-]{33}/g, severity: "high" },
  { name: "Google Maps API Key", pattern: /AIzaSy[A-Za-z0-9_-]{33}/g, severity: "medium" },
  { name: "AWS Access Key", pattern: /AKIA[A-Z0-9]{16}/g, severity: "critical" },
  { name: "Stripe Key", pattern: /(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{20,}/g, severity: "high" },
  { name: "Supabase Anon Key", pattern: /eyJ[A-Za-z0-9_-]{50,}\.eyJ[A-Za-z0-9_-]{50,}\.[A-Za-z0-9_-]+/g, severity: "high" },
  { name: "Bearer Token", pattern: /Bearer\s+[A-Za-z0-9_\-.]{20,}/gi, severity: "high" },
  { name: "Basic Auth", pattern: /Basic\s+[A-Za-z0-9+/=]{20,}/gi, severity: "high" },
  { name: "Private Key", pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g, severity: "critical" },
  { name: "Database URL", pattern: /(?:postgres|mysql|mongodb|redis):\/\/[^\s"'<>]+/gi, severity: "critical" },
  { name: "Hardcoded Password", pattern: /(?:password|passwd|pwd)\s*[:=]\s*["'][^"']{8,}["']/gi, severity: "high" },
];

/** Patterns for deep links / custom URL schemes */
const DEEP_LINK_PATTERNS: RegExp[] = [
  /[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s"'<>)}\]]+/g,      // Custom schemes myapp://
  /android:scheme="([^"]+)"/g,                            // AndroidManifest
  /CFBundleURLSchemes[\s\S]*?<string>([^<]+)<\/string>/g, // iOS Info.plist
];

// Internal domains that indicate staging/dev environments
const INTERNAL_INDICATORS = [
  "localhost", "127.0.0.1", "10.", "192.168.", "172.16.",
  "staging", "dev.", "test.", "internal.", "local",
  ".local", ":3000", ":8080", ":5000", ":4000",
];

// ─────────────────────────────────────────────────────────────────────────────
//  Extraction Engine
// ─────────────────────────────────────────────────────────────────────────────

function isInternalUrl(url: string): boolean {
  return INTERNAL_INDICATORS.some((indicator) => url.includes(indicator));
}

function extractContext(content: string, matchIndex: number, radius = 80): string {
  const start = Math.max(0, matchIndex - radius);
  const end = Math.min(content.length, matchIndex + radius);
  return content.slice(start, end).replace(/\n/g, " ").trim();
}

function extractEndpoints(content: string): ExtractedEndpoint[] {
  const seen = new Set<string>();
  const endpoints: ExtractedEndpoint[] = [];

  for (const pattern of API_URL_PATTERNS) {
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content))) {
      const url = match[0].replace(/['")\]}>]+$/, ""); // Clean trailing chars
      if (seen.has(url)) continue;
      seen.add(url);

      endpoints.push({
        url,
        context: extractContext(content, match.index),
        isInternal: isInternalUrl(url),
      });
    }
  }
  return endpoints;
}

function extractSecrets(content: string): ExtractedSecret[] {
  const seen = new Set<string>();
  const secrets: ExtractedSecret[] = [];

  for (const { name, pattern, severity } of MOBILE_SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content))) {
      const value = match[0];
      const key = `${name}:${value}`;
      if (seen.has(key)) continue;
      seen.add(key);

      secrets.push({
        type: name,
        value: value.slice(0, 20) + "..." + value.slice(-8), // Redacted
        context: extractContext(content, match.index),
        severity,
      });
    }
  }
  return secrets;
}

function extractDeepLinks(content: string): string[] {
  const seen = new Set<string>();
  const links: string[] = [];

  for (const pattern of DEEP_LINK_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content))) {
      const link = match[1] || match[0]; // Capture group or full match
      // Skip common non-deep-link schemes
      if (/^https?:\/\//i.test(link)) continue;
      if (/^(?:data|javascript|mailto|tel|blob|file):/i.test(link)) continue;
      if (!seen.has(link)) {
        seen.add(link);
        links.push(link);
      }
    }
  }
  return links;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Finding Generators
// ─────────────────────────────────────────────────────────────────────────────

function endpointFindings(endpoints: ExtractedEndpoint[], source: string): NATTFinding[] {
  const findings: NATTFinding[] = [];

  const internalEndpoints = endpoints.filter((e) => e.isInternal);
  if (internalEndpoints.length > 0) {
    findings.push({
      id: `NATT-MOB-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
      severity: "high",
      category: "information-disclosure",
      title: `${internalEndpoints.length} Internal/Dev API Endpoints in Mobile App`,
      description: `Found ${internalEndpoints.length} internal or development API endpoints hardcoded in the mobile application.`,
      evidence: internalEndpoints.slice(0, 10).map((e) => e.url).join("\n"),
      location: source,
      reproduction: "Decompile the mobile app and search for API URLs.",
      remediation: "Remove all internal/staging URLs from production builds. Use build-time configuration.",
    });
  }

  if (endpoints.length > 20) {
    findings.push({
      id: `NATT-MOB-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
      severity: "medium",
      category: "api-weakness",
      title: `Large API Surface: ${endpoints.length} Endpoints Discovered`,
      description: `Found ${endpoints.length} API endpoints in the mobile app — large attack surface for API fuzzing.`,
      evidence: endpoints.slice(0, 15).map((e) => e.url).join("\n"),
      location: source,
      reproduction: "Extract API URLs from the decompiled app bundle.",
      remediation: "Review all exposed endpoints for proper authentication and authorization.",
    });
  }

  return findings;
}

function secretFindings(secrets: ExtractedSecret[], source: string): NATTFinding[] {
  return secrets.map((s) => ({
    id: `NATT-MOB-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
    severity: s.severity,
    category: "sensitive-data" as const,
    title: `Hardcoded ${s.type} in Mobile App`,
    description: `Found a hardcoded ${s.type} in the mobile application. This can be extracted by anyone with the APK/IPA.`,
    evidence: `Type: ${s.type}\nValue: ${s.value}\nContext: ${s.context.slice(0, 200)}`,
    location: source,
    reproduction: "Decompile APK/IPA and search for credential patterns.",
    remediation: "Move secrets to a secure backend. Use server-side token exchange instead of embedding keys in the app.",
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main Exports
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scan mobile app content (strings dump, decompiled source, etc.) for
 * API endpoints, hardcoded secrets, and deep links.
 */
export function scanMobileContent(content: string, source = "mobile-app"): MobileReconResult {
  const apiEndpoints = extractEndpoints(content);
  const hardcodedSecrets = extractSecrets(content);
  const deepLinks = extractDeepLinks(content);
  const configUrls = apiEndpoints
    .filter((e) => /config|settings|feature.?flag/i.test(e.url))
    .map((e) => e.url);

  const findings = [
    ...endpointFindings(apiEndpoints, source),
    ...secretFindings(hardcodedSecrets, source),
  ];

  if (deepLinks.length > 0) {
    findings.push({
      id: `NATT-MOB-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
      severity: "low",
      category: "information-disclosure",
      title: `${deepLinks.length} Deep Link Scheme(s) Discovered`,
      description: `Found ${deepLinks.length} custom URL schemes — may enable deep link hijacking on unpatched devices.`,
      evidence: deepLinks.slice(0, 10).join("\n"),
      location: source,
      reproduction: "Check deep link handling in the app's manifest.",
      remediation: "Validate deep link parameters. Use App Links (Android) or Universal Links (iOS) instead of custom schemes.",
    });
  }

  return {
    source,
    apiEndpoints,
    hardcodedSecrets,
    configUrls,
    deepLinks,
    findings,
    scannedAt: new Date(),
  };
}

/**
 * Scan a directory of decompiled mobile app files.
 * Reads all .txt, .xml, .json, .js, .smali, .swift, .kt, .java files.
 */
export async function scanMobileAppDirectory(dir: string): Promise<MobileReconResult> {
  const extensions = [".txt", ".xml", ".json", ".js", ".smali", ".swift", ".kt", ".java", ".plist", ".strings"];
  const allContent: string[] = [];

  async function walk(dirPath: string): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        // Skip common non-useful directories
        if (["node_modules", ".git", "build", "__pycache__"].includes(entry.name)) continue;
        await walk(fullPath);
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        try {
          const content = await fs.readFile(fullPath, "utf-8");
          allContent.push(content);
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  await walk(dir);
  return scanMobileContent(allContent.join("\n---FILE_BOUNDARY---\n"), dir);
}
