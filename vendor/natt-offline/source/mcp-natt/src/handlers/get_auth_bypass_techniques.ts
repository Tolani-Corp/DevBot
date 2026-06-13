
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
}