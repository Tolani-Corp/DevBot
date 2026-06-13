
import {
  formatJwtAttack,
  formatJwtDefense,
  formatScraperPattern,
  formatDefensePlaybook,
  formatROETemplate,
  formatAuthBypassTechnique,
  buildMissionGuidanceText,
  identifyHashLocal,
  scanContentLocal,
  formatVpnProtocol,
  formatVpnLeak,
  formatVpnDefense,
  formatVpnProvider,
  DEFAULT_CREDS,
  formatPasswordAttackTechnique,
} from "../formatters.js";


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
} from "../knowledge.js";

import { generatePassword, generatePassphrase } from "../password-generator.js";

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
} from "../portswigger.js";

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
} from "../media-security.js";

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
} from "../jwt-security.js";

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
} from "../vpn-security.js";

export async function handle(args: any) {
{
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
}