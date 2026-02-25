#!/usr/bin/env node
/**
 * mcp-natt/src/index.ts — NATT MCP Knowledge Server
 *
 * Network Attack & Testing Toolkit — Model Context Protocol Server
 * Exposes NATT security knowledge to AI models via MCP.
 *
 * Tools (Core):
 *   validate_roe              — Validate mission against ROE parameters
 *   get_roe_template          — Get ROE template for a mission type
 *   get_mission_guidance      — Get mission checklist and hard limits
 *   identify_hash             — Identify hash type and crackability assessment
 *   get_password_attacks      — Get password attack techniques and defenses
 *   get_auth_bypass_techniques — Get auth bypass vector catalog
 *   get_secret_patterns       — Get secret detection signatures
 *   scan_for_secrets          — Scan content for exposed secrets
 *   get_default_credentials   — Default credential lookup
 *   get_reverse_engineering_guidance — Reverse engineering methodology and tools
 *   generate_password         — Cryptographically secure password/passphrase generator
 *
 * Tools (PortSwigger Security):
 *   get_vulnerability_info    — Web vulnerability taxonomy (20+ classes)
 *   get_dast_profile          — DAST scan profiles (full, CI/CD, API, auth)
 *   get_compliance_mapping    — Compliance framework controls (OWASP, PCI, SOC2, GDPR, ISO)
 *   get_bug_bounty_guidance   — Bug bounty methodology (scope → report)
 *   get_devsecops_guidance    — DevSecOps pipeline security integration
 *   get_pentest_methodology   — Pentest methodology (PTES-aligned)
 *
 * Tools (Media Security / Anti-Scraping):
 *   get_scraper_pattern        — Scraper/downloader attack patterns (JDownloader-inspired)
 *   get_defense_playbook       — Platform defense implementations & test cases
 *   get_platform_defense       — Platform-specific defense profiles
 *   get_content_integrity      — Content integrity verification methods
 *
 * Tools (JWT Security):
 *   decode_jwt                 — Decode and analyze JWT tokens (header, payload, weaknesses)
 *   get_jwt_attack             — JWT attack patterns catalog (12 attack types)
 *   get_jwt_defense            — JWT defense playbooks (8 categories)
 *   analyze_jwt_config         — Analyze JWT configuration for weaknesses
 *   get_jwt_library_vulns      — Library-specific JWT vulnerability signatures
 *
 * Tools (VPN Security):
 *   get_vpn_protocol           — VPN protocol security analysis (WireGuard, OpenVPN, IKEv2, etc.)
 *   get_vpn_leak               — VPN leak detection patterns (DNS, WebRTC, IPv6, kill switch)
 *   get_vpn_defense            — VPN defense playbooks (protocol hardening, leak prevention)
 *   get_vpn_provider           — VPN provider profiles with API integration info
 *   analyze_vpn_config         — Analyze VPN configuration for weaknesses
 *   analyze_ip_reputation      — Detect VPN/proxy/datacenter IPs for defense
 *   build_operational_config   — Generate proxy-aware HTTP client configuration
 *
 * Resources:
 *   natt://roe-templates           — All ROE templates
 *   natt://password-techniques     — Password attack knowledge base
 *   natt://auth-bypass             — Auth bypass research catalog
 *   natt://mission-checklists      — Mission phase checklists
 *   natt://vulnerability-taxonomy  — Web vulnerability classes
 *   natt://dast-profiles           — DAST scan profiles
 *   natt://compliance-frameworks   — Compliance framework controls
 *   natt://bug-bounty              — Bug bounty methodology
 *   natt://devsecops               — DevSecOps pipeline patterns
 *   natt://pentest-methodology     — Pentest methodology phases
 *   natt://scraper-patterns        — Scraper/downloader attack taxonomy
 *   natt://defense-playbooks       — Media platform defense playbooks
 *   natt://platform-defenses       — Platform-specific defense profiles
 *   natt://content-integrity       — Content integrity verification methods
 *   natt://jwt-attacks             — JWT attack pattern catalog
 *   natt://jwt-defenses            — JWT defense playbook library
 *   natt://jwt-library-vulns       — JWT library vulnerability signatures
 *   natt://vpn-protocols           — VPN protocol security analysis
 *   natt://vpn-leaks               — VPN leak detection patterns
 *   natt://vpn-defenses            — VPN defense playbooks
 *   natt://vpn-providers           — VPN provider profiles and API info
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import {
  ROE_TEMPLATES,
  PASSWORD_ATTACK_TECHNIQUES,
  AUTH_BYPASS_TECHNIQUES,
  MISSION_CHECKLISTS,
  REVERSE_ENGINEERING_KNOWLEDGE,
  type ROETemplate,
  type PasswordAttackTechnique,
  type AuthBypassTechnique,
  type ReverseEngineeringKnowledge,
} from "./knowledge.js";

import { generatePassword, generatePassphrase } from "./password-generator.js";

import {
  VULNERABILITY_CLASSES,
  BUG_BOUNTY_METHODOLOGY,
  DEVSECOPS_PIPELINE_STAGES,
  PENTEST_METHODOLOGY,
  DAST_SCAN_PROFILES,
  COMPLIANCE_FRAMEWORKS,
  getVulnByCategory,
  getVulnBySeverity,
  getVulnById,
  getComplianceFramework,
  getDASTProfile,
  type VulnerabilityClass,
  type WebSecurityCategory,
} from "./portswigger.js";

import {
  SCRAPER_PATTERNS,
  DEFENSE_PLAYBOOKS,
  PLATFORM_DEFENSE_PROFILES,
  CONTENT_INTEGRITY_CHECKS,
  getScraperPattern,
  getScrapersByTechnique,
  getScrapersBySeverity,
  getDefensePlaybook,
  getDefensesByCategory,
  getDefensesForTechnique,
  getPlatformProfile,
  getContentIntegrityCheck,
  getAllTestCases,
  getAutomatableTests,
  scoreDefensePosture,
  type ScraperTechnique,
  type DefenseCategory,
} from "./media-security.js";

import {
  JWT_ATTACK_PATTERNS,
  JWT_DEFENSE_PLAYBOOKS,
  JWT_LIBRARY_VULNS,
  decodeJwt,
  analyzeJwtConfig,
  getJwtAttack,
  getJwtAttacksByType,
  getJwtAttacksBySeverity,
  getAutomatableJwtAttacks,
  getJwtDefense,
  getJwtDefensesByCategory,
  getJwtDefensesForAttack,
  getAllJwtTestCases,
  getJwtLibraryVulnsByLanguage,
  getJwtLibraryVulnsBySeverity,
  scoreJwtPosture,
  type JwtAttackType,
  type JwtDefenseCategory,
  type JwtSeverity,
  type JwtAttackPattern,
  type JwtDefensePlaybook,
} from "./jwt-security.js";

import {
  VPN_PROTOCOL_ANALYSIS,
  VPN_LEAK_PATTERNS,
  VPN_DEFENSE_PLAYBOOKS,
  VPN_PROVIDER_PROFILES,
  analyzeVpnConfig,
  analyzeIpReputation,
  buildOperationalConfig,
  getVpnProtocol,
  getSecureProtocols,
  getVpnLeak,
  getVpnLeaksByType,
  getVpnLeaksBySeverity,
  getAutomatableVpnLeakTests,
  getVpnDefense,
  getVpnDefensesByCategory,
  getVpnDefensesForLeak,
  getVpnProvider,
  getVpnProvidersWithApi,
  getVpnProvidersByProtocol,
  getNoLogVpnProviders,
  getAllVpnTestCases,
  getAutomatableVpnTests,
  scoreVpnPosture,
  type VpnProtocol,
  type VpnLeakType,
  type VpnDefenseCategory,
  type VpnProvider,
  type VpnSeverity,
  type VpnLeakPattern,
  type VpnDefensePlaybook as VpnDefensePlaybookType,
  type VpnProviderProfile,
} from "./vpn-security.js";

// ─────────────────────────────────────────────────────────────────────────────
//  Server Initialization
// ─────────────────────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: "natt-mcp-knowledge",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// ─────────────────────────────────────────────────────────────────────────────
//  Tool Definitions
// ─────────────────────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_roe_template",
      description:
        "Get the Rules of Engagement (ROE) template for a specific mission type. " +
        "Returns scope guidance, time window recommendations, forbidden techniques, " +
        "evidence requirements, and contact requirements.",
      inputSchema: {
        type: "object",
        properties: {
          mission_type: {
            type: "string",
            description:
              "Mission type to get ROE template for. Options: web-app, api-recon, network-recon, osint, auth-testing, full-ghost",
          },
        },
        required: ["mission_type"],
      },
    },
    {
      name: "get_mission_guidance",
      description:
        "Get detailed mission guidance including objectives, hard limits, approved techniques, " +
        "escalation triggers, and break-glass protocol for a mission type.",
      inputSchema: {
        type: "object",
        properties: {
          mission_type: {
            type: "string",
            description: "Mission type: web-app, api-recon, network-recon, osint, auth-testing, full-ghost",
          },
          include_checklist: {
            type: "boolean",
            description: "Whether to include the full mission phase checklist (default: true)",
          },
        },
        required: ["mission_type"],
      },
    },
    {
      name: "generate_password",
      description:
        "Generate a cryptographically secure password or passphrase with hack-a-thon level optimization. " +
        "Supports high-entropy passwords with custom character sets, or diceware-style passphrases. " +
        "Returns the generated string, calculated Shannon entropy, strength rating, and estimated crack time.",
      inputSchema: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description: "Type of generation: 'password' or 'passphrase' (default: 'password')",
            enum: ["password", "passphrase"]
          },
          length: {
            type: "number",
            description: "Length of password (default: 16) or number of words for passphrase (default: 4)"
          },
          includeUppercase: { type: "boolean", description: "Include uppercase letters (default: true)" },
          includeLowercase: { type: "boolean", description: "Include lowercase letters (default: true)" },
          includeNumbers: { type: "boolean", description: "Include numbers (default: true)" },
          includeSymbols: { type: "boolean", description: "Include symbols (default: true)" },
          excludeSimilar: { type: "boolean", description: "Exclude similar characters like i, l, 1, L, o, 0, O (default: false)" },
          excludeAmbiguous: { type: "boolean", description: "Exclude ambiguous symbols like {}[]()/\\'\"`~,;:.<> (default: false)" },
          separator: { type: "string", description: "Separator for passphrase words (default: '-')" },
          capitalize: { type: "boolean", description: "Capitalize each word in passphrase (default: false)" },
          includeNumberInPassphrase: { type: "boolean", description: "Append a random number to one word in passphrase (default: false)" }
        },
        required: [],
      },
    },
    {
      name: "get_reverse_engineering_guidance",
      description:
        "Get reverse engineering (RE) guidance, techniques, tools, and resources based on the SANReN Cyber Security Challenge methodology. " +
        "Returns basic and advanced RE activities, decompilation/disassembly tools, and practice resources.",
      inputSchema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description: "Filter by category: basic, advanced, resources (optional)",
            enum: ["basic", "advanced", "resources"]
          },
        },
        required: [],
      },
    },
    {
      name: "identify_hash",
      description:
        "Identify the type of a password hash and assess its crackability. " +
        "Supports MD5, SHA-1, SHA-256, SHA-512, NTLM, bcrypt, argon2, WordPress, Drupal, and more. " +
        "Returns recommended cracking tools and hashcat modes for authorized testing.",
      inputSchema: {
        type: "object",
        properties: {
          hash: {
            type: "string",
            description: "The hash string to identify",
          },
        },
        required: ["hash"],
      },
    },
    {
      name: "get_password_attacks",
      description:
        "Get password attack techniques for authorized pen testing. " +
        "Returns technique description, tools, example commands, and corresponding mitigations.",
      inputSchema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description:
              "Attack category filter: offline, online, wordlist, rainbow, hybrid. Leave empty for all.",
          },
          target_type: {
            type: "string",
            description:
              "Target context: web-login, ssh, database, active-directory, hash-file",
          },
        },
        required: [],
      },
    },
    {
      name: "get_auth_bypass_techniques",
      description:
        "Get authentication bypass research techniques for security testing. " +
        "Returns analysis steps, test payloads, and remediations. For authorized testing only.",
      inputSchema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description:
              "Category filter: jwt, oauth, session, password-reset, mfa, http-auth, sql-auth. Leave empty for all.",
          },
          severity: {
            type: "string",
            description: "Minimum severity filter: critical, high, medium. Leave empty for all.",
          },
        },
        required: [],
      },
    },
    {
      name: "get_secret_patterns",
      description:
        "Get secret detection patterns for scanning code or configuration files. " +
        "Returns regex patterns, severity levels, and remediation guidance for 80+ provider types.",
      inputSchema: {
        type: "object",
        properties: {
          provider: {
            type: "string",
            description:
              "Provider filter: AWS, Azure, GCP, GitHub, Anthropic, OpenAI, Stripe, Slack, Twilio, etc. Leave empty for all.",
          },
          severity: {
            type: "string",
            description: "Minimum severity filter: critical, high, medium",
          },
        },
        required: [],
      },
    },
    {
      name: "scan_for_secrets",
      description:
        "Scan a string of code or configuration content for exposed secrets and API keys. " +
        "Detects 80+ patterns including AWS keys, GitHub tokens, database credentials, and more. " +
        "Returns redacted matches with remediation guidance.",
      inputSchema: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "The code/config content to scan for secrets",
          },
          filename: {
            type: "string",
            description: "Optional filename for context in results",
          },
        },
        required: ["content"],
      },
    },
    {
      name: "validate_roe_checklist",
      description:
        "Validate a mission plan against ROE requirements. Provide mission details and get a " +
        "checklist of requirements that must be met before launching.",
      inputSchema: {
        type: "object",
        properties: {
          target: {
            type: "string",
            description: "Target URL, IP, or domain",
          },
          mission_type: {
            type: "string",
            description: "Mission type: web-app, api-recon, network-recon, osint, auth-testing",
          },
          ghost_mode: {
            type: "string",
            description: "Ghost mode: passive, stealth, active",
          },
          has_authorization: {
            type: "boolean",
            description: "Whether written authorization has been obtained",
          },
          has_scope_document: {
            type: "boolean",
            description: "Whether a scope document defining in-scope targets exists",
          },
          has_emergency_contact: {
            type: "boolean",
            description: "Whether an emergency contact has been established",
          },
        },
        required: ["target", "mission_type", "ghost_mode"],
      },
    },
    {
      name: "get_default_credentials",
      description:
        "Look up default credentials for common services and devices. " +
        "Used in security assessments to test if default credentials have been changed.",
      inputSchema: {
        type: "object",
        properties: {
          service: {
            type: "string",
            description:
              "Service name to look up: cisco, apache, jenkins, mysql, postgres, mongodb, wordpress, etc.",
          },
        },
        required: ["service"],
      },
    },
    // ── PortSwigger Security Knowledge Tools ──────────────────────────────
    {
      name: "get_vulnerability_info",
      description:
        "Get detailed information about a web vulnerability class from the PortSwigger Web Security Academy. " +
        "Returns description, impact, test cases with payloads, detection methods, and remediation guidance. " +
        "Covers 20+ vulnerability categories: SQLi, XSS, CSRF, SSRF, XXE, IDOR, path traversal, " +
        "request smuggling, race conditions, prototype pollution, GraphQL, JWT, OAuth, and more.",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Vulnerability ID (e.g. vuln-sqli, vuln-xss, vuln-ssrf). Use list_all=true to see all IDs.",
          },
          category: {
            type: "string",
            description: "Category filter: injection, xss, ssrf, xxe, broken-access, jwt, oauth, graphql, " +
              "cors, clickjacking, request-smuggling, race-conditions, prototype-pollution, etc.",
          },
          severity: {
            type: "string",
            description: "Severity filter: critical, high, medium, low, info",
          },
          list_all: {
            type: "boolean",
            description: "If true, return a summary list of all vulnerability classes (no details)",
          },
        },
        required: [],
      },
    },
    {
      name: "get_dast_profile",
      description:
        "Get a DAST (Dynamic Application Security Testing) scan profile with scan checks, " +
        "crawl configuration, CI/CD integration settings, and compliance mappings. " +
        "Profiles: dast-full (160+ checks, 4h), dast-cicd (fast, <15min), dast-api (REST/GraphQL), dast-auth (auth focus).",
      inputSchema: {
        type: "object",
        properties: {
          profile_id: {
            type: "string",
            description: "Profile ID: dast-full, dast-cicd, dast-api, dast-auth. Leave empty for all.",
          },
        },
        required: [],
      },
    },
    {
      name: "get_compliance_mapping",
      description:
        "Get compliance framework controls and their mapping to security scan checks. " +
        "Frameworks: owasp-top10-2021, pci-dss-4, soc2-type2, gdpr-security, iso-27001. " +
        "Returns control ID, name, requirement, test procedure, evidence needed, and automatable scan checks.",
      inputSchema: {
        type: "object",
        properties: {
          framework_id: {
            type: "string",
            description: "Framework ID: owasp-top10-2021, pci-dss-4, soc2-type2, gdpr-security, iso-27001",
          },
          control_id: {
            type: "string",
            description: "Optional specific control ID (e.g. A03, 6.4.1, CC6.1, Art.32)",
          },
        },
        required: [],
      },
    },
    {
      name: "get_bug_bounty_guidance",
      description:
        "Get bug bounty hunting methodology covering all phases from scope analysis through " +
        "report submission. Includes techniques, tools, time estimates, and deliverables for each phase.",
      inputSchema: {
        type: "object",
        properties: {
          phase: {
            type: "string",
            description: "Optional phase filter: scope, recon, discovery, exploitation, reporting. Leave empty for all.",
          },
        },
        required: [],
      },
    },
    {
      name: "get_devsecops_guidance",
      description:
        "Get DevSecOps CI/CD security integration patterns including shift-left practices, " +
        "pipeline security gates, DAST/SAST/SCA integration, and CI example configs for " +
        "GitHub Actions, GitLab CI, Jenkins, and Azure DevOps.",
      inputSchema: {
        type: "object",
        properties: {
          stage: {
            type: "string",
            description: "Pipeline stage: shiftLeft, commitStage, buildStage, testStage, deployStage, monitorStage. Leave empty for all.",
          },
        },
        required: [],
      },
    },
    {
      name: "get_pentest_methodology",
      description:
        "Get structured penetration testing methodology (PTES-aligned) with phases, " +
        "activities, tools, outputs, and risk levels. From pre-engagement through reporting.",
      inputSchema: {
        type: "object",
        properties: {
          phase: {
            type: "string",
            description: "Optional phase filter: pre-engagement, intelligence, scanning, vulnerability, exploitation, reporting",
          },
        },
        required: [],
      },
    },
    // ── Media Security / Anti-Scraping Tools ─────────────────────────────
    {
      name: "get_scraper_pattern",
      description:
        "Get scraper/downloader attack patterns inspired by JDownloader, yt-dlp, and similar tools. " +
        "Returns attack vectors, HTTP signatures, indicator patterns, detection methods, and defenses. " +
        "Covers: link crawling, direct HTTP, cookie replay, HLS/DASH harvesting, API abuse, " +
        "browser emulation, stream capture, header spoofing, thumbnail enumeration, redirect following.",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Pattern ID (e.g. scrp-link-crawl, scrp-m3u8-harvest). Use list_all=true to see all.",
          },
          technique: {
            type: "string",
            description: "Technique filter: link-crawl, direct-http, cookie-replay, m3u8-harvest, api-abuse, browser-emulation, stream-capture, header-spoof, thumbnail-enum, follow-redirect",
          },
          severity: {
            type: "string",
            description: "Severity filter: critical, high, medium, low, info",
          },
          list_all: {
            type: "boolean",
            description: "If true, return summary list of all scraper patterns",
          },
        },
        required: [],
      },
    },
    {
      name: "get_defense_playbook",
      description:
        "Get media platform defense playbooks with implementation guidance, test cases, and bypass difficulty ratings. " +
        "Covers: URL signing, rate limiting, browser/TLS fingerprinting, DRM, forensic watermarking, " +
        "hotlink protection, anti-debug/obfuscation. Each includes server-side, client-side, and CDN configs.",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Playbook ID (e.g. def-signed-urls, def-drm, def-watermark). Use list_all=true to see all.",
          },
          category: {
            type: "string",
            description: "Category filter: url-signing, rate-limiting, fingerprinting, drm, watermarking, hotlink-protection, anti-debug",
          },
          for_technique: {
            type: "string",
            description: "Get defenses that mitigate a specific scraper technique (e.g. m3u8-harvest, direct-http)",
          },
          list_all: {
            type: "boolean",
            description: "If true, return summary list of all defense playbooks",
          },
        },
        required: [],
      },
    },
    {
      name: "get_platform_defense",
      description:
        "Get a complete platform-specific defense profile with threat model, defense stack, " +
        "monitoring signals, and incident response procedures. " +
        "Platforms: adult-content-platform, streaming-platform.",
      inputSchema: {
        type: "object",
        properties: {
          platform: {
            type: "string",
            description: "Platform type: adult-content-platform, streaming-platform",
          },
        },
        required: [],
      },
    },
    {
      name: "get_content_integrity",
      description:
        "Get content integrity verification methods: hash verification, watermark detection, " +
        "DRM validation, metadata/EXIF sanitization, and content fingerprint embedding. " +
        "Returns implementation guidance and recommended tools.",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Check ID (e.g. ci-hash-verify, ci-watermark-detect, ci-drm-check, ci-metadata-strip, ci-fingerprint-embed)",
          },
          method: {
            type: "string",
            description: "Method filter: hash-verify, watermark-detect, drm-check, metadata-strip, exif-sanitize, fingerprint-embed",
          },
        },
        required: [],
      },
    },
    // ── JWT Security Tools ────────────────────────────────────────────────
    {
      name: "decode_jwt",
      description:
        "Decode a JWT token into its header, payload, and signature components with security analysis. " +
        "Detects weaknesses: none algorithm, embedded jwk/jku/x5c, missing claims (exp, iss, aud), " +
        "excessive lifetime, sensitive data in payload, path traversal in kid, and more. " +
        "This is a PASSIVE decoder — it does NOT verify signatures.",
      inputSchema: {
        type: "object",
        properties: {
          token: {
            type: "string",
            description: "The JWT token string to decode (format: header.payload.signature)",
          },
        },
        required: ["token"],
      },
    },
    {
      name: "get_jwt_attack",
      description:
        "Get JWT attack patterns from a catalog of 12 attack types. Each includes step-by-step " +
        "exploitation, payloads, indicators, detection methods, tools, and remediation. " +
        "Attacks: none-algorithm, algorithm-confusion, jwk-self-signed, jku-poisoning, x5c-chain-injection, " +
        "kid-path-traversal, kid-sql-injection, kid-command-injection, claim-tampering, token-replay, " +
        "cross-service-confusion, nested-jwt-abuse.",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Attack ID (e.g. jwt-atk-01). Use list_all=true to see all IDs.",
          },
          attack_type: {
            type: "string",
            description: "Attack type filter: none-algorithm, algorithm-confusion, jwk-self-signed, jku-poisoning, " +
              "x5c-chain-injection, kid-path-traversal, kid-sql-injection, kid-command-injection, " +
              "claim-tampering, token-replay, cross-service-confusion, nested-jwt-abuse",
          },
          severity: {
            type: "string",
            description: "Severity filter: critical, high, medium, low",
          },
          automatable_only: {
            type: "boolean",
            description: "If true, return only automatable attacks (for CI integration)",
          },
          list_all: {
            type: "boolean",
            description: "If true, return summary list of all JWT attack patterns",
          },
        },
        required: [],
      },
    },
    {
      name: "get_jwt_defense",
      description:
        "Get JWT defense playbooks with implementation guidance, code examples (Node.js, Python, Go, Java), " +
        "test cases, and effectiveness ratings. 8 categories: algorithm-pinning, key-management, " +
        "claim-validation, token-lifecycle, library-hardening, transport-security, monitoring, architecture.",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Defense ID (e.g. jwt-def-01). Use list_all=true to see all IDs.",
          },
          category: {
            type: "string",
            description: "Category: algorithm-pinning, key-management, claim-validation, token-lifecycle, " +
              "library-hardening, transport-security, monitoring, architecture",
          },
          for_attack: {
            type: "string",
            description: "Get defenses that mitigate a specific attack type (e.g. algorithm-confusion, none-algorithm)",
          },
          list_all: {
            type: "boolean",
            description: "If true, return summary list of all defense playbooks",
          },
        },
        required: [],
      },
    },
    {
      name: "analyze_jwt_config",
      description:
        "Analyze a JWT verification configuration for security weaknesses. " +
        "Checks: algorithm pinning, none rejection, mixed algorithm types, claim requirements, " +
        "key length, token lifetime, JWK/JKU header handling, kid validation. " +
        "Returns weakness list with severity, CWE, and recommendations.",
      inputSchema: {
        type: "object",
        properties: {
          algorithm: { type: "string", description: "Primary algorithm in use" },
          accepted_algorithms: {
            type: "array",
            items: { type: "string" },
            description: "List of accepted algorithms (e.g. ['RS256', 'RS384'])",
          },
          key_length: { type: "number", description: "HMAC key length in bits (for symmetric algorithms)" },
          require_exp: { type: "boolean", description: "Whether expiration claim is required" },
          require_iss: { type: "boolean", description: "Whether issuer claim is validated" },
          require_aud: { type: "boolean", description: "Whether audience claim is validated" },
          max_lifetime: { type: "number", description: "Maximum token lifetime in seconds" },
          allow_none: { type: "boolean", description: "Whether 'none' algorithm is accepted" },
          validate_kid: { type: "boolean", description: "Whether 'kid' header is sanitized/validated" },
          allow_jwk_header: { type: "boolean", description: "Whether embedded JWK in header is allowed" },
          allow_jku_header: { type: "boolean", description: "Whether JKU header URL is followed" },
        },
        required: [],
      },
    },
    {
      name: "get_jwt_library_vulns",
      description:
        "Get known JWT library vulnerabilities and CVEs. Covers: jsonwebtoken (Node.js), PyJWT (Python), " +
        "ruby-jwt, php-jwt, go-jose (Go), Nimbus JOSE+JWT (Java), jose (Node.js). " +
        "Returns CVE, affected versions, vulnerability details, and fix guidance.",
      inputSchema: {
        type: "object",
        properties: {
          language: {
            type: "string",
            description: "Filter by language: Node.js, Python, Ruby, PHP, Go, Java",
          },
          severity: {
            type: "string",
            description: "Filter by severity: critical, high, medium, low, info",
          },
        },
        required: [],
      },
    },
    // ─── VPN Security Tools ────────────────────────────────────────────────────
    {
      name: "get_vpn_protocol",
      description:
        "Get detailed security analysis for a VPN protocol. Covers: WireGuard, OpenVPN, IKEv2, IPSec, " +
        "L2TP, PPTP, SSTP, Shadowsocks, V2Ray. Returns security rating, strengths, weaknesses, " +
        "recommended ciphers, known vulnerabilities, and best practices.",
      inputSchema: {
        type: "object",
        properties: {
          protocol: {
            type: "string",
            description: "Protocol to analyze: wireguard, openvpn, ikev2, ipsec, l2tp, pptp, sstp, shadowsocks, v2ray",
          },
          list_all: {
            type: "boolean",
            description: "List all protocols with security ratings",
          },
          secure_only: {
            type: "boolean",
            description: "List only protocols with rating >= 4/5",
          },
        },
        required: [],
      },
    },
    {
      name: "get_vpn_leak",
      description:
        "Get VPN leak detection patterns and test methodologies. Covers: DNS leaks, WebRTC leaks, " +
        "IPv6 leaks, kill switch bypass, traffic correlation, split tunnel leaks, captive portal bypass, " +
        "torrent leaks, timing attacks, browser fingerprinting. Returns detection methods, indicators, " +
        "test steps, tools, and remediation.",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Specific leak pattern ID (e.g., 'leak-dns-01')",
          },
          leak_type: {
            type: "string",
            description: "Filter by type: dns-leak, webrtc-leak, ipv6-leak, kill-switch-bypass, traffic-correlation, etc.",
          },
          severity: {
            type: "string",
            description: "Filter by severity: critical, high, medium, low, info",
          },
          automatable_only: {
            type: "boolean",
            description: "Return only leaks with automated test methods",
          },
          list_all: {
            type: "boolean",
            description: "List all leak patterns",
          },
        },
        required: [],
      },
    },
    {
      name: "get_vpn_defense",
      description:
        "Get VPN defense playbooks with implementation guidance. Covers: protocol hardening, " +
        "leak prevention, traffic obfuscation, key management, authentication, network isolation, " +
        "monitoring, failsafe configuration. Returns effectiveness rating, code examples in multiple " +
        "languages, configuration guidance, common mistakes, and test cases.",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Specific defense playbook ID (e.g., 'def-leak-01')",
          },
          category: {
            type: "string",
            description: "Filter by category: protocol-hardening, leak-prevention, traffic-obfuscation, key-management, authentication, network-isolation, monitoring, failsafe",
          },
          for_leak: {
            type: "string",
            description: "Get defenses that mitigate a specific leak type",
          },
          list_all: {
            type: "boolean",
            description: "List all defense playbooks",
          },
        },
        required: [],
      },
    },
    {
      name: "get_vpn_provider",
      description:
        "Get VPN provider profiles with API integration capabilities. Covers: Mullvad, NordVPN, " +
        "ExpressVPN, ProtonVPN, Tailscale, Surfshark, PIA, custom/self-hosted. Returns API availability, " +
        "supported protocols, features, logging policy, automation capabilities.",
      inputSchema: {
        type: "object",
        properties: {
          provider: {
            type: "string",
            description: "Provider: mullvad, nordvpn, expressvpn, protonvpn, tailscale, surfshark, privateinternetaccess, custom",
          },
          with_api: {
            type: "boolean",
            description: "List only providers with API access",
          },
          supports_protocol: {
            type: "string",
            description: "Filter by supported protocol: wireguard, openvpn, ikev2",
          },
          no_logs: {
            type: "boolean",
            description: "List only no-logs providers",
          },
          list_all: {
            type: "boolean",
            description: "List all VPN providers",
          },
        },
        required: [],
      },
    },
    {
      name: "analyze_vpn_config",
      description:
        "Analyze a VPN configuration for security weaknesses. Checks protocol, cipher, " +
        "TLS version, key exchange, kill switch, DNS leak protection, IPv6 settings, " +
        "split tunneling, and logging. Returns severity-rated findings with recommendations.",
      inputSchema: {
        type: "object",
        properties: {
          protocol: {
            type: "string",
            description: "VPN protocol: wireguard, openvpn, ikev2, ipsec, l2tp, pptp",
          },
          cipher: {
            type: "string",
            description: "Cipher suite in use (e.g., AES-256-GCM, CHACHA20-POLY1305)",
          },
          tls_version: {
            type: "string",
            description: "TLS version (e.g., 1.2, 1.3)",
          },
          key_exchange: {
            type: "string",
            description: "Key exchange algorithm (e.g., ECDHE, DH)",
          },
          kill_switch: {
            type: "boolean",
            description: "Is kill switch enabled?",
          },
          dns_leak_protection: {
            type: "boolean",
            description: "Is DNS leak protection enabled?",
          },
          ipv6_enabled: {
            type: "boolean",
            description: "Is IPv6 enabled on the connection?",
          },
          split_tunnel: {
            type: "boolean",
            description: "Is split tunneling enabled?",
          },
          logging_enabled: {
            type: "boolean",
            description: "Is verbose logging enabled?",
          },
        },
        required: [],
      },
    },
    {
      name: "analyze_ip_reputation",
      description:
        "Analyze an IP address for VPN/proxy/datacenter indicators. Used for platform defense " +
        "to detect users hiding behind VPNs/proxies. Returns IP type classification, risk score, " +
        "datacenter ASN detection, geo mismatch detection, and confidence level.",
      inputSchema: {
        type: "object",
        properties: {
          ip: {
            type: "string",
            description: "IP address to analyze",
          },
          asn: {
            type: "number",
            description: "Autonomous System Number (if known)",
          },
          asn_org: {
            type: "string",
            description: "ASN organization name (if known)",
          },
          reverse_dns: {
            type: "string",
            description: "Reverse DNS hostname (if known)",
          },
          geo_country: {
            type: "string",
            description: "GeoIP country (if known)",
          },
          user_claimed_country: {
            type: "string",
            description: "Country the user claims to be in",
          },
        },
        required: ["ip"],
      },
    },
    {
      name: "build_operational_config",
      description:
        "Generate operational configuration for VPN-compatible HTTP clients. Creates proxy settings, " +
        "DNS-over-HTTPS configuration, timeout tuning for high-latency VPN connections, and network settings.",
      inputSchema: {
        type: "object",
        properties: {
          vpn_provider: {
            type: "string",
            description: "VPN provider for provider-specific optimizations",
          },
          proxy_url: {
            type: "string",
            description: "Proxy URL (http://..., socks5://...)",
          },
          use_doh: {
            type: "boolean",
            description: "Enable DNS-over-HTTPS (default: true)",
          },
          doh_provider: {
            type: "string",
            description: "DoH provider URL (default: cloudflare)",
          },
          force_ipv4: {
            type: "boolean",
            description: "Force IPv4-only connections (default: true)",
          },
          high_latency_mode: {
            type: "boolean",
            description: "Enable extended timeouts for high-latency VPN connections",
          },
        },
        required: [],
      },
    },
  ],
}));

// ─────────────────────────────────────────────────────────────────────────────
//  Tool Handlers
// ─────────────────────────────────────────────────────────────────────────────

const toolCache = new Map<string, any>();
const MAX_CACHE_SIZE = 50;
const MAX_RESPONSE_LENGTH = 16000; // 16KB limit for context window optimization

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const cacheKey = `${name}:${JSON.stringify(args || {})}`;
    if (toolCache.has(cacheKey)) {
      return toolCache.get(cacheKey);
    }

    try {
      const handler = await import(`./handlers/${name}.js`);
      const result = await handler.handle(args);
      
      // Context Window Optimization: Truncate large text responses
      if (result && result.content && Array.isArray(result.content)) {
        for (const item of result.content) {
          if (item.type === "text" && typeof item.text === "string" && item.text.length > MAX_RESPONSE_LENGTH) {
            item.text = item.text.substring(0, MAX_RESPONSE_LENGTH) + 
              "\n\n... [TRUNCATED FOR CONTEXT WINDOW OPTIMIZATION. PLEASE USE MORE SPECIFIC QUERIES] ...";
          }
        }
      }

      if (toolCache.size >= MAX_CACHE_SIZE) {
        const firstKey = toolCache.keys().next().value;
        if (firstKey) toolCache.delete(firstKey);
      }
      toolCache.set(cacheKey, result);
      
      return result;
    } catch (e: any) {
      if (e.code === 'ERR_MODULE_NOT_FOUND') {
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
      }
      throw e;
    }
  } catch (err) {
    return {
      content: [{ type: "text", text: `Tool error: ${String(err)}` }],
      isError: true,
    };
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  Resource Handlers
// ─────────────────────────────────────────────────────────────────────────────

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: "natt://roe-templates",
      name: "ROE Templates",
      description: "All Rules of Engagement templates for NATT mission types",
      mimeType: "application/json",
    },
    {
      uri: "natt://password-techniques",
      name: "Password Attack Techniques",
      description: "Knowledge base of password attack techniques and defenses",
      mimeType: "application/json",
    },
    {
      uri: "natt://auth-bypass",
      name: "Auth Bypass Techniques",
      description: "Authentication bypass research catalog",
      mimeType: "application/json",
    },
    {
      uri: "natt://mission-checklists",
      name: "Mission Checklists",
      description: "Phase-by-phase mission checklists for each mission type",
      mimeType: "application/json",
    },
    {
      uri: "natt://vulnerability-taxonomy",
      name: "Web Vulnerability Taxonomy",
      description: "Complete PortSwigger-aligned vulnerability classes with test cases and remediation",
      mimeType: "application/json",
    },
    {
      uri: "natt://dast-profiles",
      name: "DAST Scan Profiles",
      description: "Dynamic Application Security Testing scan profiles (full, CI/CD, API, auth)",
      mimeType: "application/json",
    },
    {
      uri: "natt://compliance-frameworks",
      name: "Compliance Frameworks",
      description: "OWASP Top 10, PCI DSS, SOC 2, GDPR, ISO 27001 control mappings",
      mimeType: "application/json",
    },
    {
      uri: "natt://bug-bounty",
      name: "Bug Bounty Methodology",
      description: "Complete bug bounty hunting methodology from scope to reporting",
      mimeType: "application/json",
    },
    {
      uri: "natt://devsecops",
      name: "DevSecOps Pipeline",
      description: "CI/CD security integration patterns with pipeline stage guidance",
      mimeType: "application/json",
    },
    {
      uri: "natt://pentest-methodology",
      name: "Pentest Methodology",
      description: "PTES-aligned penetration testing methodology phases",
      mimeType: "application/json",
    },
    {
      uri: "natt://scraper-patterns",
      name: "Scraper Attack Patterns",
      description: "JDownloader-inspired scraper/downloader attack taxonomy with detection and defense",
      mimeType: "application/json",
    },
    {
      uri: "natt://defense-playbooks",
      name: "Defense Playbooks",
      description: "Media platform defense implementations with test cases and bypass difficulty ratings",
      mimeType: "application/json",
    },
    {
      uri: "natt://platform-defenses",
      name: "Platform Defense Profiles",
      description: "Complete defense profiles for adult content and streaming platforms",
      mimeType: "application/json",
    },
    {
      uri: "natt://content-integrity",
      name: "Content Integrity Checks",
      description: "Content integrity verification methods (hash, watermark, DRM, metadata, fingerprint)",
      mimeType: "application/json",
    },
    {
      uri: "natt://jwt-attacks",
      name: "JWT Attack Patterns",
      description: "12 JWT attack types with payloads, steps, detection, and remediation",
      mimeType: "application/json",
    },
    {
      uri: "natt://jwt-defenses",
      name: "JWT Defense Playbooks",
      description: "8 JWT defense categories with code examples, test cases, and effectiveness ratings",
      mimeType: "application/json",
    },
    {
      uri: "natt://jwt-library-vulns",
      name: "JWT Library Vulnerabilities",
      description: "Known CVEs and vulnerabilities in popular JWT libraries across languages",
      mimeType: "application/json",
    },
    {
      uri: "natt://vpn-protocols",
      name: "VPN Protocol Analysis",
      description: "Security analysis of VPN protocols (WireGuard, OpenVPN, IKEv2, etc.)",
      mimeType: "application/json",
    },
    {
      uri: "natt://vpn-leaks",
      name: "VPN Leak Patterns",
      description: "VPN leak detection patterns (DNS, WebRTC, IPv6, kill switch bypass)",
      mimeType: "application/json",
    },
    {
      uri: "natt://vpn-defenses",
      name: "VPN Defense Playbooks",
      description: "VPN defense implementations with code examples and test cases",
      mimeType: "application/json",
    },
    {
      uri: "natt://vpn-providers",
      name: "VPN Provider Profiles",
      description: "VPN provider profiles with API integration capabilities",
      mimeType: "application/json",
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case "natt://roe-templates":
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(ROE_TEMPLATES, null, 2) }],
      };
    case "natt://password-techniques":
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(PASSWORD_ATTACK_TECHNIQUES, null, 2) }],
      };
    case "natt://auth-bypass":
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(AUTH_BYPASS_TECHNIQUES, null, 2) }],
      };
    case "natt://mission-checklists":
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(MISSION_CHECKLISTS, null, 2) }],
      };
    case "natt://vulnerability-taxonomy":
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(VULNERABILITY_CLASSES, null, 2) }],
      };
    case "natt://dast-profiles":
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(DAST_SCAN_PROFILES, null, 2) }],
      };
    case "natt://compliance-frameworks":
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(COMPLIANCE_FRAMEWORKS, null, 2) }],
      };
    case "natt://bug-bounty":
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(BUG_BOUNTY_METHODOLOGY, null, 2) }],
      };
    case "natt://devsecops":
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(DEVSECOPS_PIPELINE_STAGES, null, 2) }],
      };
    case "natt://pentest-methodology":
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(PENTEST_METHODOLOGY, null, 2) }],
      };
    case "natt://scraper-patterns":
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(SCRAPER_PATTERNS, null, 2) }],
      };
    case "natt://defense-playbooks":
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(DEFENSE_PLAYBOOKS, null, 2) }],
      };
    case "natt://platform-defenses":
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(PLATFORM_DEFENSE_PROFILES, null, 2) }],
      };
    case "natt://content-integrity":
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(CONTENT_INTEGRITY_CHECKS, null, 2) }],
      };
    case "natt://jwt-attacks":
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(JWT_ATTACK_PATTERNS, null, 2) }],
      };
    case "natt://jwt-defenses":
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(JWT_DEFENSE_PLAYBOOKS, null, 2) }],
      };
    case "natt://jwt-library-vulns":
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(JWT_LIBRARY_VULNS, null, 2) }],
      };
    case "natt://vpn-protocols":
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(VPN_PROTOCOL_ANALYSIS, null, 2) }],
      };
    case "natt://vpn-leaks":
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(VPN_LEAK_PATTERNS, null, 2) }],
      };
    case "natt://vpn-defenses":
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(VPN_DEFENSE_PLAYBOOKS, null, 2) }],
      };
    case "natt://vpn-providers":
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(VPN_PROVIDER_PROFILES, null, 2) }],
      };
    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  Start Server
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[NATT MCP] 👻 NATT Knowledge Server running");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
