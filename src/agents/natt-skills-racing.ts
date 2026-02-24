/**
 * natt-skills-racing.ts — Racing Platform Reconnaissance & Analysis
 *
 * NATT Expansion Skill: Reconnaissance of racing/betting platforms,
 * API endpoints, data providers (TVG, Equibase, USTA), and historical
 * pattern analysis for race betting intelligence.
 *
 * Capabilities:
 *  - Platform discovery via Censys (TVG, TwinSpires, AmWager APIs)
 *  - Track data source enumeration (Equibase, USTA, Harness Tracks)
 *  - Betting platform infrastructure analysis
 *  - Weather API integration points (NWS, Weather Underground)
 *  - Historical result pattern recognition
 *  - Race program parser testing
 *  - Authentication mechanism discovery
 *
 * Use Cases:
 *  - Discover API endpoints for racing data providers
 *  - Map betting platform infrastructure and versions
 *  - Identify data feed integration points
 *  - Reverse engineer odds calculation endpoints
 *  - Validate racing prediction algorithm data sources
 *
 * Integrates with: BettorsACE MCP Racing Tools (@bettorsace/mcp/racing-*)
 * Requires: CENSYS_API_ID + CENSYS_API_SECRET (optional but recommended)
 */

import type { NATTFinding, NATTSeverity } from "./natt.js";
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RacingPlatform {
  name: string;
  domain: string;
  ips: string[];
  services: RacingService[];
  apiEndpoints: string[];
  authMethods: string[];
  dataProviders: string[];
}

export interface RacingService {
  port: number;
  protocol: string;
  banner: string;
  version?: string;
  apiPaths?: string[];
}

export interface RacingDataSource {
  name: string;
  type: "thoroughbred" | "harness" | "greyhound" | "quarter-horse";
  endpoints: string[];
  authRequired: boolean;
  rateLimit?: string;
  documentation?: string;
}

export interface RacingReconResult {
  platform: string;
  censysData?: CensysRacingResult;
  discoveredEndpoints: string[];
  dataProviders: RacingDataSource[];
  findings: NATTFinding[];
  reconAt: Date;
}

export interface CensysRacingResult {
  query: string;
  hosts: Array<{
    ip: string;
    services: Array<{
      port: number;
      serviceName: string;
      http?: {
        title?: string;
        serverHeader?: string;
        responseHeaders?: Record<string, string>;
      };
    }>;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Known Racing Data Providers
// ─────────────────────────────────────────────────────────────────────────────

const KNOWN_RACING_PROVIDERS: RacingDataSource[] = [
  {
    name: "TVG (FanDuel Racing)",
    type: "thoroughbred",
    endpoints: [
      "https://www.tvg.com/api/",
      "https://edge.tvg.com/",
      "https://www.tvg.com/promos/",
    ],
    authRequired: true,
    rateLimit: "Unknown — likely 100 req/min",
    documentation: "https://www.tvg.com/account/api-access (requires account)",
  },
  {
    name: "Equibase",
    type: "thoroughbred",
    endpoints: [
      "https://www.equibase.com/static/",
      "https://www.equibase.com/premium/",
      "https://query.equibase.com/",
    ],
    authRequired: true,
    rateLimit: "Subscription-based tiers",
    documentation: "https://www.equibase.com/about/content.cfm?SAP=TN_DataProducts",
  },
  {
    name: "USTA (United States Trotting Association)",
    type: "harness",
    endpoints: [
      "https://www.ustrotting.com/trackmaster/",
      "https://www.ustrotting.com/results/",
      "https://ustrotting.com/api/",
    ],
    authRequired: true,
    rateLimit: "Unknown",
    documentation: "https://www.ustrotting.com/resources/data-sales/",
  },
  {
    name: "National Weather Service",
    type: "thoroughbred", // Used by all racing types
    endpoints: [
      "https://api.weather.gov/points/",
      "https://api.weather.gov/gridpoints/",
    ],
    authRequired: false,
    rateLimit: "Rate limit via User-Agent header",
    documentation: "https://www.weather.gov/documentation/services-web-api",
  },
  {
    name: "TwinSpires",
    type: "thoroughbred",
    endpoints: [
      "https://www.twinspires.com/api/",
      "https://edge.twinspires.com/",
    ],
    authRequired: true,
    documentation: "No public API docs",
  },
  {
    name: "AmWager",
    type: "harness",
    endpoints: ["https://www.amwager.com/api/", "https://amwager.com/bet/"],
    authRequired: true,
    documentation: "No public API docs",
  },
  {
    name: "BetAmerica",
    type: "thoroughbred",
    endpoints: ["https://www.betamerica.com/racing/api/"],
    authRequired: true,
    documentation: "No public API docs",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Censys API Integration
// ─────────────────────────────────────────────────────────────────────────────

function getCensysCredentials(): { id: string; secret: string } | null {
  const id = process.env.CENSYS_API_ID;
  const secret = process.env.CENSYS_API_SECRET;
  if (!id || !secret) return null;
  return { id, secret };
}

async function censysSearchRacingPlatform(query: string): Promise<CensysRacingResult | null> {
  const creds = getCensysCredentials();
  if (!creds) return null;

  try {
    const auth = Buffer.from(`${creds.id}:${creds.secret}`).toString("base64");
    const res = await fetch("https://search.censys.io/api/v2/hosts/search", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, per_page: 20 }),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as {
      result: {
        hits: Array<{
          ip: string;
          services: Array<{
            port: number;
            service_name: string;
            http?: {
              response?: {
                html_title?: string;
                headers?: { server?: string; [key: string]: string | undefined };
              };
            };
          }>;
        }>;
      };
    };

    const hosts = data.result.hits.map((hit) => ({
      ip: hit.ip,
      services: hit.services.map((svc) => ({
        port: svc.port,
        serviceName: svc.service_name,
        http: svc.http?.response
          ? {
              title: svc.http.response.html_title,
              serverHeader: svc.http.response.headers?.server,
              responseHeaders: svc.http.response.headers,
            }
          : undefined,
      })),
    }));

    return { query, hosts };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Racing Platform Recon
// ─────────────────────────────────────────────────────────────────────────────

export async function racingPlatformRecon(platform: string): Promise<RacingReconResult> {
  const findings: NATTFinding[] = [];
  const discoveredEndpoints: string[] = [];
  const dataProviders: RacingDataSource[] = [];

  // Known provider lookup
  const knownProvider = KNOWN_RACING_PROVIDERS.find(
    (p) => p.name.toLowerCase().includes(platform.toLowerCase()) || platform.toLowerCase().includes(p.name.toLowerCase())
  );

  if (knownProvider) {
    dataProviders.push(knownProvider);
    discoveredEndpoints.push(...knownProvider.endpoints);

    findings.push({
      id: crypto.randomUUID(),
      title: `Known Racing Data Provider: ${knownProvider.name}`,
      severity: "info",
      category: "data-source",
      description: `${knownProvider.name} is a known ${knownProvider.type} racing data provider.`,
      evidence: {
        endpoints: knownProvider.endpoints,
        authRequired: knownProvider.authRequired,
        rateLimit: knownProvider.rateLimit || "Unknown",
        documentation: knownProvider.documentation || "None",
      },
      remediation: knownProvider.authRequired
        ? "API access requires account registration and API key generation."
        : "Free access available with rate limiting.",
      references: [knownProvider.documentation || "N/A"],
    });
  }

  // Censys search for infrastructure
  const censysData = await censysSearchRacingPlatform(`services.http.response.html_title:"${platform}"`);
  if (censysData && censysData.hosts.length > 0) {
    for (const host of censysData.hosts) {
      findings.push({
        id: crypto.randomUUID(),
        title: `Censys Discovery: ${platform} Infrastructure`,
        severity: "info",
        category: "osint",
        description: `Discovered ${host.services.length} services on ${host.ip} associated with ${platform}.`,
        evidence: {
          ip: host.ip,
          services: host.services,
        },
        remediation: "Analyze services for API endpoints, authentication methods, and version information.",
        references: ["https://search.censys.io/"],
      });

      // Extract HTTP endpoints
      for (const svc of host.services) {
        if (svc.http && svc.port === 443) {
          discoveredEndpoints.push(`https://${host.ip}/`);
        } else if (svc.http && svc.port === 80) {
          discoveredEndpoints.push(`http://${host.ip}/`);
        }
      }
    }
  }

  // Endpoint enumeration via common patterns
  const commonApiPaths = [
    "/api/v1/",
    "/api/v2/",
    "/rest/",
    "/graphql",
    "/api/races",
    "/api/odds",
    "/api/tracks",
    "/api/horses",
    "/api/results",
    "/api/betting",
  ];

  if (knownProvider) {
    for (const base of knownProvider.endpoints) {
      for (const path of commonApiPaths) {
        discoveredEndpoints.push(`${base}${path}`);
      }
    }
  }

  return {
    platform,
    censysData: censysData ?? undefined,
    discoveredEndpoints: [...new Set(discoveredEndpoints)], // Deduplicate
    dataProviders,
    findings,
    reconAt: new Date(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Track Location Discovery
// ─────────────────────────────────────────────────────────────────────────────

export interface TrackLocation {
  code: string;
  name: string;
  type: "thoroughbred" | "harness" | "greyhound" | "quarter-horse";
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  dataProviders: string[];
}

export const MAJOR_TRACKS: TrackLocation[] = [
  {
    code: "BEL",
    name: "Belmont Park",
    type: "thoroughbred",
    city: "Elmont",
    state: "NY",
    latitude: 40.7156,
    longitude: -73.7189,
    dataProviders: ["Equibase", "TVG", "TwinSpires"],
  },
  {
    code: "CD",
    name: "Churchill Downs",
    type: "thoroughbred",
    city: "Louisville",
    state: "KY",
    latitude: 38.2049,
    longitude: -85.7704,
    dataProviders: ["Equibase", "TVG", "TwinSpires"],
  },
  {
    code: "SA",
    name: "Santa Anita",
    type: "thoroughbred",
    city: "Arcadia",
    state: "CA",
    latitude: 34.1407,
    longitude: -118.0391,
    dataProviders: ["Equibase", "TVG"],
  },
  {
    code: "M",
    name: "The Meadowlands",
    type: "harness",
    city: "East Rutherford",
    state: "NJ",
    latitude: 40.8136,
    longitude: -74.0744,
    dataProviders: ["USTA", "TVG", "AmWager"],
  },
  {
    code: "YR",
    name: "Yonkers Raceway",
    type: "harness",
    city: "Yonkers",
    state: "NY",
    latitude: 40.9312,
    longitude: -73.8987,
    dataProviders: ["USTA", "TVG", "AmWager"],
  },
  {
    code: "PHL",
    name: "Parx Racing",
    type: "thoroughbred",
    city: "Bensalem",
    state: "PA",
    latitude: 40.0956,
    longitude: -74.9519,
    dataProviders: ["Equibase", "TVG"],
  },
  {
    code: "GP",
    name: "Gulfstream Park",
    type: "thoroughbred",
    city: "Hallandale Beach",
    state: "FL",
    latitude: 25.9898,
    longitude: -80.1398,
    dataProviders: ["Equibase", "TVG", "TwinSpires"],
  },
  {
    code: "KEE",
    name: "Keeneland",
    type: "thoroughbred",
    city: "Lexington",
    state: "KY",
    latitude: 38.0444,
    longitude: -84.5972,
    dataProviders: ["Equibase", "TVG"],
  },
  {
    code: "SAR",
    name: "Saratoga",
    type: "thoroughbred",
    city: "Saratoga Springs",
    state: "NY",
    latitude: 43.0815,
    longitude: -73.7885,
    dataProviders: ["Equibase", "TVG", "TwinSpires"],
  },
  {
    code: "GG",
    name: "Golden Gate Fields",
    type: "thoroughbred",
    city: "Albany",
    state: "CA",
    latitude: 37.8869,
    longitude: -122.3156,
    dataProviders: ["Equibase", "TVG"],
  },
];

export function getTracksByProvider(provider: string): TrackLocation[] {
  return MAJOR_TRACKS.filter((track) => track.dataProviders.some((p) => p.toLowerCase().includes(provider.toLowerCase())));
}

// ─────────────────────────────────────────────────────────────────────────────
//  Racing API Authentication Discovery
// ─────────────────────────────────────────────────────────────────────────────

export interface APIAuthFindings {
  endpoint: string;
  methods: string[];
  findings: NATTFinding[];
}

export async function discoverRacingAPIAuth(endpoint: string): Promise<APIAuthFindings> {
  const findings: NATTFinding[] = [];
  const methods: string[] = [];

  try {
    const res = await fetch(endpoint, { method: "OPTIONS" });
    const allowHeader = res.headers.get("allow");
    if (allowHeader) {
      methods.push(...allowHeader.split(",").map((m) => m.trim()));
    }

    const authHeader = res.headers.get("www-authenticate");
    if (authHeader) {
      findings.push({
        id: crypto.randomUUID(),
        title: "Authentication Required",
        severity: "info",
        category: "auth",
        description: `Endpoint requires authentication: ${authHeader}`,
        evidence: { wwwAuthenticate: authHeader },
        remediation: "Obtain valid credentials or API key.",
        references: [],
      });

      if (authHeader.toLowerCase().includes("bearer")) {
        methods.push("bearer-token");
      }
      if (authHeader.toLowerCase().includes("basic")) {
        methods.push("basic-auth");
      }
    }

    const apiKeyParams = ["api_key", "apikey", "key", "token", "access_token"];
    for (const param of apiKeyParams) {
      const testUrl = `${endpoint}?${param}=test`;
      const testRes = await fetch(testUrl, { method: "GET" });
      if (testRes.status === 401 || testRes.status === 403) {
        findings.push({
          id: crypto.randomUUID(),
          title: `API Key Parameter Detected: ${param}`,
          severity: "info",
          category: "auth",
          description: `Endpoint expects API key via query parameter: ${param}`,
          evidence: { parameter: param, statusCode: testRes.status },
          remediation: "Register for API access and obtain key.",
          references: [],
        });
        methods.push(`query-param-${param}`);
      }
    }
  } catch (err: unknown) {
    findings.push({
      id: crypto.randomUUID(),
      title: "Endpoint Unreachable",
      severity: "low",
      category: "connectivity",
      description: `Failed to connect to ${endpoint}: ${(err as Error).message}`,
      evidence: { error: (err as Error).message },
      remediation: "Verify endpoint URL and network connectivity.",
      references: [],
    });
  }

  return { endpoint, methods: [...new Set(methods)], findings };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Export All Capabilities
// ─────────────────────────────────────────────────────────────────────────────

export const RACING_RECON_CATALOG = {
  version: "1.0.0",
  missions: ["racing-recon"],
  skills: [
    {
      name: "Platform Reconnaissance",
      function: "racingPlatformRecon",
      description: "Discover racing platform infrastructure via Censys and enumerate API endpoints.",
    },
    {
      name: "Track Location Database",
      function: "getTracksByProvider",
      description: "Retrieve major track locations and associated data providers.",
    },
    {
      name: "API Authentication Discovery",
      function: "discoverRacingAPIAuth",
      description: "Enumerate authentication methods for racing API endpoints.",
    },
  ],
  knownProviders: KNOWN_RACING_PROVIDERS.length,
  majorTracks: MAJOR_TRACKS.length,
};
