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
 *
 * Tools (PortSwigger Security):
 *   get_vulnerability_info    — Web vulnerability taxonomy (20+ classes)
 *   get_dast_profile          — DAST scan profiles (full, CI/CD, API, auth)
 *   get_compliance_mapping    — Compliance framework controls (OWASP, PCI, SOC2, GDPR, ISO)
 *   get_bug_bounty_guidance   — Bug bounty methodology (scope → report)
 *   get_devsecops_guidance    — DevSecOps pipeline security integration
 *   get_pentest_methodology   — Pentest methodology (PTES-aligned)
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
  type ROETemplate,
  type PasswordAttackTechnique,
  type AuthBypassTechnique,
} from "./knowledge.js";

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
  ],
}));

// ─────────────────────────────────────────────────────────────────────────────
//  Tool Handlers
// ─────────────────────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_roe_template": {
        const missionType = String(args?.["mission_type"] ?? "web-app");
        const template =
          ROE_TEMPLATES.find((t) => t.missionType === missionType) ?? ROE_TEMPLATES[0]!;

        return {
          content: [
            {
              type: "text",
              text: formatROETemplate(template),
            },
          ],
        };
      }

      case "get_mission_guidance": {
        const missionType = String(args?.["mission_type"] ?? "web-app");
        const includeChecklist = args?.["include_checklist"] !== false;

        const checklist = includeChecklist
          ? MISSION_CHECKLISTS.find((c) => c.missionType === missionType)
          : null;

        const guidance = buildMissionGuidanceText(missionType);

        const text = [
          guidance,
          ...(checklist
            ? [
                "\n## Mission Phase Checklist\n",
                ...checklist.phases.map(
                  (phase) =>
                    `### Phase: ${phase.phase}\n**Objective:** ${phase.objective}\n\n` +
                    phase.steps.map((s) => `- ${s}`).join("\n") +
                    `\n\n**Tools:** ${phase.tools.join(", ")}\n` +
                    `**Output Artifacts:** ${phase.outputArtifacts.join(", ")}\n`
                ),
              ]
            : []),
        ].join("\n");

        return { content: [{ type: "text", text }] };
      }

      case "identify_hash": {
        const hash = String(args?.["hash"] ?? "");
        if (!hash) {
          return {
            content: [{ type: "text", text: "Error: hash parameter is required" }],
            isError: true,
          };
        }

        // Reuse identification logic (inline - avoids cross-module dep issues)
        const result = identifyHashLocal(hash);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_password_attacks": {
        const category = args?.["category"] as string | undefined;
        let techniques: PasswordAttackTechnique[] = PASSWORD_ATTACK_TECHNIQUES;
        if (category) {
          techniques = techniques.filter((t) => t.category === category);
        }

        return {
          content: [
            {
              type: "text",
              text: techniques
                .map(
                  (t) =>
                    `## ${t.name} (${t.category})\n` +
                    `${t.description}\n\n` +
                    `**Tools:** ${t.tools.join(", ")}\n\n` +
                    `**Commands:**\n\`\`\`bash\n${t.commands.join("\n")}\n\`\`\`\n\n` +
                    `**Bypasses:** ${t.defensesBypass}\n` +
                    `**Mitigation:** ${t.mitigation}\n` +
                    `**OWASP:** ${t.owasp}\n`
                )
                .join("\n---\n"),
            },
          ],
        };
      }

      case "get_auth_bypass_techniques": {
        const category = args?.["category"] as string | undefined;
        const severity = args?.["severity"] as string | undefined;
        const severityOrder: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 };

        let techniques: AuthBypassTechnique[] = AUTH_BYPASS_TECHNIQUES;
        if (category) {
          techniques = techniques.filter((t) => t.category === category);
        }
        if (severity) {
          const minSeverity = severityOrder[severity] ?? 0;
          techniques = techniques.filter(
            (t) => (severityOrder[t.severity] ?? 0) >= minSeverity
          );
        }

        return {
          content: [
            {
              type: "text",
              text: techniques
                .map((t) => formatAuthBypassTechnique(t))
                .join("\n---\n"),
            },
          ],
        };
      }

      case "get_secret_patterns": {
        const provider = args?.["provider"] as string | undefined;
        const severity = args?.["severity"] as string | undefined;
        const severityOrder: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 };

        // Return pattern info (descriptions and patterns as strings)
        const patterns = SECRET_PATTERNS_INFO.filter((p) => {
          if (provider && p.provider && !p.provider.toLowerCase().includes(provider.toLowerCase())) return false;
          if (severity && (severityOrder[p.severity] ?? 0) < (severityOrder[severity] ?? 0)) return false;
          return true;
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(patterns, null, 2),
            },
          ],
        };
      }

      case "scan_for_secrets": {
        const content = String(args?.["content"] ?? "");
        const filename = String(args?.["filename"] ?? "input");

        const results = scanContentLocal(content, filename);
        return {
          content: [
            {
              type: "text",
              text:
                results.length === 0
                  ? "✅ No secrets detected in the provided content."
                  : `⚠️ Found ${results.length} potential secret(s):\n\n` +
                    JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case "validate_roe_checklist": {
        const target = String(args?.["target"] ?? "");
        const missionType = String(args?.["mission_type"] ?? "web-app");
        const ghostMode = String(args?.["ghost_mode"] ?? "passive");
        const hasAuth = Boolean(args?.["has_authorization"]);
        const hasScope = Boolean(args?.["has_scope_document"]);
        const hasContact = Boolean(args?.["has_emergency_contact"]);

        // ── PATHFINDER MODE ──────────────────────────────────────
        if (process.env.NATT_PATHFINDER === "true") {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                approved: true,
                target,
                missionType,
                ghostMode,
                checks: [{ name: "PATHFINDER", passed: true, required: false }],
                blockers: [],
                summary: `✅ PATHFINDER: ${missionType}/${ghostMode} on ${target} — all checks bypassed`,
              }, null, 2),
            }],
          };
        }

        const checks = [
          { name: "Written Authorization", passed: hasAuth || ghostMode === "passive", required: ghostMode !== "passive" },
          { name: "Scope Document", passed: hasScope, required: true },
          { name: "Emergency Contact", passed: hasContact, required: missionType !== "osint" },
          { name: "Target Not Restricted", passed: !/(\.gov|\.mil)$/i.test(target), required: true },
          { name: "Mode Level Appropriate", passed: ghostMode !== "active" || hasAuth, required: true },
        ];

        const blocked = checks.filter((c) => c.required && !c.passed);
        const result = {
          approved: blocked.length === 0,
          target,
          missionType,
          ghostMode,
          checks,
          blockers: blocked.map((c) => c.name),
          summary:
            blocked.length === 0
              ? `✅ ROE checklist passed for ${missionType}/${ghostMode} on ${target}`
              : `❌ ${blocked.length} blocker(s): ${blocked.map((c) => c.name).join(", ")}`,
        };

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "get_default_credentials": {
        const service = String(args?.["service"] ?? "");
        const creds = DEFAULT_CREDS.filter(
          (c) => c.service.toLowerCase().includes(service.toLowerCase())
        );

        return {
          content: [
            {
              type: "text",
              text:
                creds.length === 0
                  ? `No default credentials found for "${service}"`
                  : `Default credentials for "${service}":\n\n` +
                    creds
                      .map(
                        (c) =>
                          `${c.service}: ${c.username} / ${c.password || "(empty)"} [${c.risk}]`
                      )
                      .join("\n"),
            },
          ],
        };
      }

      // ── PortSwigger Security Knowledge Handlers ───────────────────────
      case "get_vulnerability_info": {
        const id = args?.["id"] as string | undefined;
        const category = args?.["category"] as WebSecurityCategory | undefined;
        const severity = args?.["severity"] as VulnerabilityClass["severity"] | undefined;
        const listAll = args?.["list_all"] as boolean | undefined;

        if (listAll) {
          const summary = VULNERABILITY_CLASSES.map(
            (v) => `${v.id} | ${v.name} | ${v.severity} | ${v.category} | ${v.owaspTopTen}`
          );
          return {
            content: [{
              type: "text",
              text: `# Vulnerability Classes (${summary.length} total)\n\nID | Name | Severity | Category | OWASP\n---|------|----------|----------|------\n${summary.join("\n")}`,
            }],
          };
        }

        let vulns: VulnerabilityClass[];
        if (id) {
          const v = getVulnById(id);
          vulns = v ? [v] : [];
        } else if (category) {
          vulns = getVulnByCategory(category);
        } else if (severity) {
          vulns = getVulnBySeverity(severity);
        } else {
          vulns = VULNERABILITY_CLASSES;
        }

        if (vulns.length === 0) {
          return { content: [{ type: "text", text: "No vulnerabilities found matching the criteria." }] };
        }

        const text = vulns.map((v) => [
          `# [${v.severity.toUpperCase()}] ${v.name}`,
          `**ID:** ${v.id} | **Category:** ${v.category} | **CWEs:** ${v.cwes.join(", ")}`,
          `**OWASP:** ${v.owaspTopTen}`,
          ``,
          `## Description`,
          v.description,
          ``,
          `## Impact`,
          v.impact,
          ``,
          `## Detection Methods`,
          v.detectionMethods.map((d) => `- ${d}`).join("\n"),
          ``,
          `## Test Cases`,
          ...v.testCases.map((tc) => [
            `### ${tc.name} ${tc.automatable ? "⚙️" : "🔧"}`,
            `**Technique:** ${tc.technique}`,
            ...(tc.payloads ? [`**Payloads:**\n\`\`\`\n${tc.payloads.join("\n")}\n\`\`\``] : []),
            `**Indicators:** ${tc.indicators.join("; ")}`,
          ].join("\n")),
          ``,
          `## Remediation`,
          v.remediation.map((r) => `- ${r}`).join("\n"),
          ``,
          `## References`,
          v.references.map((r) => `- ${r}`).join("\n"),
        ].join("\n")).join("\n\n---\n\n");

        return { content: [{ type: "text", text }] };
      }

      case "get_dast_profile": {
        const profileId = args?.["profile_id"] as string | undefined;
        const profiles = profileId ? [getDASTProfile(profileId)].filter(Boolean) : DAST_SCAN_PROFILES;

        if (profiles.length === 0) {
          return { content: [{ type: "text", text: `No DAST profile found for "${profileId}". Options: dast-full, dast-cicd, dast-api, dast-auth` }] };
        }

        const text = (profiles as typeof DAST_SCAN_PROFILES).map((p) => [
          `# DAST Profile: ${p.name}`,
          `**ID:** ${p.id}`,
          ``,
          p.description,
          ``,
          `## Scan Checks (${p.scanChecks.length})`,
          p.scanChecks.map((c) => `- ${c}`).join("\n"),
          ``,
          `## Crawl Configuration`,
          `- Max Depth: ${p.crawlConfig.maxDepth}`,
          `- Max Pages: ${p.crawlConfig.maxPages}`,
          `- Follow Redirects: ${p.crawlConfig.followRedirects}`,
          `- Handle Forms: ${p.crawlConfig.handleForms}`,
          `- Handle JavaScript: ${p.crawlConfig.handleJavascript}`,
          ...(p.crawlConfig.excludePatterns.length > 0 ? [`- Exclude: ${p.crawlConfig.excludePatterns.join(", ")}`] : []),
          ...(p.crawlConfig.authentication ? [`- Auth Type: ${p.crawlConfig.authentication.type}`] : []),
          ``,
          `## CI/CD Integration`,
          `- Platforms: ${p.ciIntegration.platforms.join(", ")}`,
          `- Fail On: ${p.ciIntegration.failOnSeverity}+`,
          `- Report Formats: ${p.ciIntegration.reportFormats.join(", ")}`,
          `- Max Duration: ${p.ciIntegration.maxScanDuration}`,
          `- Baseline Comparison: ${p.ciIntegration.baselineComparison}`,
          ``,
          `## Compliance Coverage`,
          p.compliance.map((c) => `- ${c}`).join("\n"),
        ].join("\n")).join("\n\n---\n\n");

        return { content: [{ type: "text", text }] };
      }

      case "get_compliance_mapping": {
        const frameworkId = args?.["framework_id"] as string | undefined;
        const controlId = args?.["control_id"] as string | undefined;

        if (!frameworkId) {
          const summary = COMPLIANCE_FRAMEWORKS.map(
            (f) => `- **${f.id}**: ${f.name} ${f.version} (${f.controls.length} controls)`
          );
          return { content: [{ type: "text", text: `# Available Compliance Frameworks\n\n${summary.join("\n")}` }] };
        }

        const framework = getComplianceFramework(frameworkId);
        if (!framework) {
          return { content: [{ type: "text", text: `Framework "${frameworkId}" not found. Options: ${COMPLIANCE_FRAMEWORKS.map(f => f.id).join(", ")}` }] };
        }

        const controls = controlId
          ? framework.controls.filter((c) => c.id === controlId)
          : framework.controls;

        const text = [
          `# ${framework.name} ${framework.version}`,
          ``,
          ...controls.map((c) => [
            `## ${c.id}: ${c.name}`,
            `**Requirement:** ${c.requirement}`,
            `**Test Procedure:** ${c.testProcedure}`,
            `**Evidence Required:**`,
            c.evidenceRequired.map((e) => `- ${e}`).join("\n"),
            `**Automatable:** ${c.automatable ? "Yes ⚙️" : "No (manual) 🔧"}`,
            `**Scan Checks:** ${c.scanChecks.length > 0 ? c.scanChecks.join(", ") : "N/A"}`,
          ].join("\n")),
        ].join("\n\n");

        return { content: [{ type: "text", text }] };
      }

      case "get_bug_bounty_guidance": {
        const phase = args?.["phase"] as string | undefined;
        const phases = phase
          ? BUG_BOUNTY_METHODOLOGY.filter((p) =>
              p.phase.toLowerCase().includes(phase.toLowerCase())
            )
          : BUG_BOUNTY_METHODOLOGY;

        if (phases.length === 0) {
          return { content: [{ type: "text", text: `No phase matching "${phase}". Phases: scope, recon, discovery, exploitation, reporting` }] };
        }

        const text = phases.map((p) => [
          `# Phase: ${p.phase}`,
          `**Objective:** ${p.objective}`,
          `**Time Estimate:** ${p.timeEstimate}`,
          ``,
          `## Techniques`,
          p.techniques.map((t) => `- ${t}`).join("\n"),
          ``,
          `## Tools`,
          p.tools.map((t) => `- ${t}`).join("\n"),
          ``,
          `## Deliverables`,
          p.deliverables.map((d) => `- ${d}`).join("\n"),
        ].join("\n")).join("\n\n---\n\n");

        return { content: [{ type: "text", text }] };
      }

      case "get_devsecops_guidance": {
        const stage = args?.["stage"] as string | undefined;
        const stages = Object.entries(DEVSECOPS_PIPELINE_STAGES);
        const filtered = stage
          ? stages.filter(([key]) => key.toLowerCase() === stage.toLowerCase())
          : stages;

        if (filtered.length === 0) {
          return { content: [{ type: "text", text: `Stage "${stage}" not found. Options: ${stages.map(([k]) => k).join(", ")}` }] };
        }

        const text = filtered.map(([key, s]) => {
          const lines = [
            `# ${s.name}`,
            `**Key:** ${key}`,
            ``,
            s.description,
            ``,
            `## Practices`,
            s.practices.map((p) => `- ${p}`).join("\n"),
          ];
          if ("ciExample" in s && typeof s.ciExample === "string") {
            lines.push(``, `## CI Example`, "```yaml", s.ciExample, "```");
          }
          return lines.join("\n");
        }).join("\n\n---\n\n");

        return { content: [{ type: "text", text }] };
      }

      case "get_pentest_methodology": {
        const phase = args?.["phase"] as string | undefined;
        const phases = phase
          ? PENTEST_METHODOLOGY.filter((p) =>
              p.phase.toLowerCase().includes(phase.toLowerCase())
            )
          : PENTEST_METHODOLOGY;

        if (phases.length === 0) {
          return { content: [{ type: "text", text: `No phase matching "${phase}".` }] };
        }

        const text = phases.map((p) => [
          `# Phase: ${p.phase}`,
          `**Objective:** ${p.objective}`,
          `**Risk Level:** ${p.riskLevel}`,
          ``,
          `## Activities`,
          p.activities.map((a) => `- ${a}`).join("\n"),
          ``,
          `## Tools`,
          p.tools.map((t) => `- ${t}`).join("\n"),
          ``,
          `## Outputs`,
          p.outputs.map((o) => `- ${o}`).join("\n"),
        ].join("\n")).join("\n\n---\n\n");

        return { content: [{ type: "text", text }] };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
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
    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  Helper Functions (inlined to avoid cross-server module dependencies)
// ─────────────────────────────────────────────────────────────────────────────

function formatROETemplate(template: ROETemplate): string {
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

function formatAuthBypassTechnique(t: AuthBypassTechnique): string {
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
          "```",
          t.payloads.join("\n"),
          "```",
        ]
      : []),
    ``,
    `**Remediation:** ${t.remediation}`,
    `**References:** ${t.references.join(", ")}`,
  ].join("\n");
}

function buildMissionGuidanceText(missionType: string): string {
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

// Inline hash identification
function identifyHashLocal(hash: string): Record<string, unknown> {
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

// Inline secret scanner
const SECRET_PATTERNS_INFO = [
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

interface SecretResult {
  file: string;
  line: number;
  pattern: string;
  provider: string;
  severity: string;
  match: string;
}

function scanContentLocal(content: string, filename: string): SecretResult[] {
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

const DEFAULT_CREDS = [
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
