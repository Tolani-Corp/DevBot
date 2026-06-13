/**
 * natt-skills-osint.ts — Shodan / Censys OSINT Integration
 *
 * NATT Expansion Skill: Queries Shodan and Censys for host intelligence —
 * open ports, services, banners, vulns, ASN, geolocation, and historical data.
 *
 * Requires: SHODAN_API_KEY env var (free tier: 1 req/sec, 100 results)
 * Optional: CENSYS_API_ID + CENSYS_API_SECRET for additional enrichment
 */

import type {
  NATTFinding,
  NATTSeverity,
} from "./natt.js";
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ShodanHostResult {
  ip: string;
  hostnames: string[];
  org: string;
  asn: string;
  isp: string;
  os: string | null;
  ports: number[];
  vulns: string[];
  city: string;
  country: string;
  services: ShodanService[];
  lastUpdate: string;
}

export interface ShodanService {
  port: number;
  transport: string;
  product: string;
  version: string;
  banner: string;
  vulns: string[];
}

export interface CensysHostResult {
  ip: string;
  services: Array<{
    port: number;
    serviceName: string;
    transportProtocol: string;
    certificate?: string;
  }>;
  location: { country: string; city: string };
  autonomousSystem: { asn: number; name: string };
}

export interface OSINTLookupResult {
  ip: string;
  shodan?: ShodanHostResult;
  censys?: CensysHostResult;
  findings: NATTFinding[];
  queriedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Shodan API
// ─────────────────────────────────────────────────────────────────────────────

function getShodanKey(): string | null {
  return process.env.SHODAN_API_KEY || null;
}

async function shodanHostLookup(ip: string): Promise<ShodanHostResult | null> {
  const key = getShodanKey();
  if (!key) return null;

  try {
    const res = await fetch(`https://api.shodan.io/shodan/host/${ip}?key=${key}`);
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;

    const services: ShodanService[] = [];
    const dataEntries = (data.data || []) as Array<Record<string, unknown>>;
    for (const svc of dataEntries) {
      services.push({
        port: svc.port as number,
        transport: (svc.transport as string) || "tcp",
        product: (svc.product as string) || "unknown",
        version: (svc.version as string) || "",
        banner: ((svc.data as string) || "").slice(0, 500),
        vulns: Object.keys((svc.vulns || {}) as Record<string, unknown>),
      });
    }

    return {
      ip: data.ip_str as string,
      hostnames: (data.hostnames as string[]) || [],
      org: (data.org as string) || "",
      asn: (data.asn as string) || "",
      isp: (data.isp as string) || "",
      os: (data.os as string) || null,
      ports: (data.ports as number[]) || [],
      vulns: Object.keys((data.vulns || {}) as Record<string, unknown>),
      city: (data.city as string) || "",
      country: (data.country_name as string) || "",
      services,
      lastUpdate: (data.last_update as string) || "",
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Censys API
// ─────────────────────────────────────────────────────────────────────────────

function getCensysCreds(): { id: string; secret: string } | null {
  const id = process.env.CENSYS_API_ID;
  const secret = process.env.CENSYS_API_SECRET;
  if (!id || !secret) return null;
  return { id, secret };
}

async function censysHostLookup(ip: string): Promise<CensysHostResult | null> {
  const creds = getCensysCreds();
  if (!creds) return null;

  try {
    const auth = Buffer.from(`${creds.id}:${creds.secret}`).toString("base64");
    const res = await fetch(`https://search.censys.io/api/v2/hosts/${ip}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) return null;
    const data = await res.json() as { result?: Record<string, unknown> };
    const host = data.result;
    if (!host) return null;

    return {
      ip,
      services: ((host.services || []) as Array<Record<string, unknown>>).map((s) => ({
        port: s.port as number,
        serviceName: (s.service_name as string) || "unknown",
        transportProtocol: (s.transport_protocol as string) || "TCP",
        certificate: s.certificate as string | undefined,
      })),
      location: {
        country: ((host.location as Record<string, unknown>)?.country as string) || "",
        city: ((host.location as Record<string, unknown>)?.city as string) || "",
      },
      autonomousSystem: {
        asn: ((host.autonomous_system as Record<string, unknown>)?.asn as number) || 0,
        name: ((host.autonomous_system as Record<string, unknown>)?.name as string) || "",
      },
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Finding Generators
// ─────────────────────────────────────────────────────────────────────────────

function makeFinding(
  severity: NATTSeverity,
  title: string,
  description: string,
  evidence: string,
  location: string,
  remediation: string,
): NATTFinding {
  return {
    id: `NATT-OSINT-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
    severity,
    category: "network-exposure",
    title,
    description,
    evidence,
    location,
    reproduction: "Query Shodan/Censys for the target IP.",
    remediation,
  };
}

function shodanToFindings(result: ShodanHostResult): NATTFinding[] {
  const findings: NATTFinding[] = [];

  // Known CVEs from Shodan
  for (const cve of result.vulns) {
    findings.push(
      makeFinding("high", `Shodan CVE: ${cve}`,
        `Shodan reports ${cve} for ${result.ip}. Service-level vulnerability detected remotely.`,
        `Host: ${result.ip}\nCVE: ${cve}\nPorts: ${result.ports.join(", ")}`,
        result.ip,
        `Investigate ${cve} and patch affected services. Verify with targeted scan.`),
    );
  }

  // Dangerous ports
  const dangerousPorts: Record<number, string> = {
    21: "FTP", 23: "Telnet", 445: "SMB", 1433: "MSSQL", 3306: "MySQL",
    3389: "RDP", 5432: "PostgreSQL", 5900: "VNC", 6379: "Redis", 9200: "Elasticsearch",
    27017: "MongoDB", 11211: "Memcached",
  };

  for (const port of result.ports) {
    if (dangerousPorts[port]) {
      findings.push(
        makeFinding("high", `Exposed ${dangerousPorts[port]} (port ${port})`,
          `${dangerousPorts[port]} on port ${port} is publicly accessible. This service should never be internet-facing.`,
          `Host: ${result.ip}:${port}\nService: ${dangerousPorts[port]}\nOrg: ${result.org}`,
          `${result.ip}:${port}`,
          `Restrict ${dangerousPorts[port]} behind firewall/VPN. Bind to localhost or private network.`),
      );
    }
  }

  // Service-level vulns
  for (const svc of result.services) {
    for (const vuln of svc.vulns) {
      findings.push(
        makeFinding("high", `${svc.product} ${svc.version} — ${vuln}`,
          `${svc.product} ${svc.version} on port ${svc.port} is affected by ${vuln}.`,
          `Port: ${svc.port}\nProduct: ${svc.product} ${svc.version}\nBanner: ${svc.banner.slice(0, 200)}`,
          `${result.ip}:${svc.port}`,
          `Update ${svc.product} to the latest patched version.`),
      );
    }
  }

  return findings;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main Export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Perform OSINT lookup on an IP address via Shodan + Censys.
 * Returns combined intelligence and NATT findings.
 */
export async function osintLookup(ip: string): Promise<OSINTLookupResult> {
  const [shodan, censys] = await Promise.all([
    shodanHostLookup(ip),
    censysHostLookup(ip),
  ]);

  const findings: NATTFinding[] = [];

  if (shodan) {
    findings.push(...shodanToFindings(shodan));
  }

  if (!shodan && !censys) {
    findings.push(
      makeFinding("info", "OSINT Lookup Unavailable",
        "Neither Shodan nor Censys API keys are configured. Set SHODAN_API_KEY and/or CENSYS_API_ID/CENSYS_API_SECRET.",
        `Target: ${ip}`, ip,
        "Configure OSINT API keys to enable host intelligence lookups."),
    );
  }

  return {
    ip,
    shodan: shodan ?? undefined,
    censys: censys ?? undefined,
    findings,
    queriedAt: new Date(),
  };
}

/**
 * Shodan search query — search for hosts matching a query string.
 * Example: "org:MyCompany port:3389"
 */
export async function shodanSearch(query: string, maxResults = 10): Promise<{
  total: number;
  matches: Array<{ ip: string; port: number; org: string; product: string; version: string }>;
}> {
  const key = getShodanKey();
  if (!key) return { total: 0, matches: [] };

  try {
    const res = await fetch(
      `https://api.shodan.io/shodan/host/search?key=${key}&query=${encodeURIComponent(query)}&minify=true`,
    );
    if (!res.ok) return { total: 0, matches: [] };
    const data = await res.json() as { total?: number; matches?: Array<Record<string, unknown>> };

    return {
      total: data.total || 0,
      matches: (data.matches || []).slice(0, maxResults).map((m) => ({
        ip: (m.ip_str as string) || "",
        port: (m.port as number) || 0,
        org: (m.org as string) || "",
        product: (m.product as string) || "",
        version: (m.version as string) || "",
      })),
    };
  } catch {
    return { total: 0, matches: [] };
  }
}
