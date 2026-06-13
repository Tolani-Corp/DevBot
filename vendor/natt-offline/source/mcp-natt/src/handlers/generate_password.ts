
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
        const type = String(args?.["type"] ?? "password");
        
        let result;
        if (type === "passphrase") {
          result = generatePassphrase({
            words: args?.["length"] ? Number(args["length"]) : undefined,
            separator: args?.["separator"] ? String(args["separator"]) : undefined,
            capitalize: args?.["capitalize"] ? Boolean(args["capitalize"]) : undefined,
            includeNumber: args?.["includeNumberInPassphrase"] ? Boolean(args["includeNumberInPassphrase"]) : undefined,
          });
        } else {
          result = generatePassword({
            length: args?.["length"] ? Number(args["length"]) : undefined,
            includeUppercase: args?.["includeUppercase"] !== undefined ? Boolean(args["includeUppercase"]) : undefined,
            includeLowercase: args?.["includeLowercase"] !== undefined ? Boolean(args["includeLowercase"]) : undefined,
            includeNumbers: args?.["includeNumbers"] !== undefined ? Boolean(args["includeNumbers"]) : undefined,
            includeSymbols: args?.["includeSymbols"] !== undefined ? Boolean(args["includeSymbols"]) : undefined,
            excludeSimilar: args?.["excludeSimilar"] !== undefined ? Boolean(args["excludeSimilar"]) : undefined,
            excludeAmbiguous: args?.["excludeAmbiguous"] !== undefined ? Boolean(args["excludeAmbiguous"]) : undefined,
          });
        }

        const text = [
          `## Generated ${type === "passphrase" ? "Passphrase" : "Password"}`,
          `**Value:** \`${result.value}\``,
          `**Entropy:** ${result.entropy} bits`,
          `**Strength:** ${result.strength}`,
          `**Estimated Time to Crack:** ${result.timeToCrack} (assuming 100B guesses/sec)`
        ].join("\n");

        return { content: [{ type: "text", text }] };
      }
}