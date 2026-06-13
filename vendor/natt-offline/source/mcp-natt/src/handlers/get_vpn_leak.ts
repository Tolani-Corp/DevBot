
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
        const listAll = args?.["list_all"] === true;
        if (listAll) {
          const summary = VPN_LEAK_PATTERNS.map((l: VpnLeakPattern) =>
            `- **${l.id}** [${l.severity.toUpperCase()} CVSS:${l.cvss}] ${l.name} (${l.type}) ${l.automatable ? "⚙️" : "🔧"}`
          ).join("\n");
          return { content: [{ type: "text", text: `# VPN Leak Patterns (${VPN_LEAK_PATTERNS.length})\n\n${summary}` }] };
        }

        const leakId = args?.["id"] as string | undefined;
        if (leakId) {
          const leak = getVpnLeak(leakId);
          if (!leak) return { content: [{ type: "text", text: `Leak "${leakId}" not found.` }] };
          return { content: [{ type: "text", text: formatVpnLeak(leak) }] };
        }

        const leakType = args?.["leak_type"] as VpnLeakType | undefined;
        const leakSeverity = args?.["severity"] as VpnSeverity | undefined;
        const automatableOnly = args?.["automatable_only"] === true;

        let leaks: VpnLeakPattern[] = [...VPN_LEAK_PATTERNS];
        if (automatableOnly) leaks = getAutomatableVpnLeakTests();
        if (leakType) leaks = leaks.filter((l: VpnLeakPattern) => l.type === leakType);
        if (leakSeverity) leaks = leaks.filter((l: VpnLeakPattern) => l.severity === leakSeverity);

        if (leaks.length === 0) return { content: [{ type: "text", text: "No VPN leaks match the filters." }] };

        const text = leaks.map(formatVpnLeak).join("\n\n---\n\n");
        return { content: [{ type: "text", text }] };
      }
}