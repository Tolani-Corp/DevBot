import {
  selectAcquisitionProvider,
  type AcquisitionProvider,
} from "./web-acquisition-policy.js";

export interface ExternalIntelligenceRoutingInput {
  requiresJavascript: boolean;
  requiresStatefulBrowser: boolean;
  knownStaticSource: boolean;
  requiresSiteMapping?: boolean;
  requiresManagedMonitoring?: boolean;
  providerPreference: AcquisitionProvider[];
  providerAvailability: Partial<Record<AcquisitionProvider, boolean>>;
}

export interface ExternalIntelligenceRoutingDecision {
  provider: AcquisitionProvider;
  capability: "standard-acquisition" | "site-map" | "managed-monitor";
  requiresApproval: boolean;
  rationale: string;
}

function firecrawlAvailable(input: ExternalIntelligenceRoutingInput): boolean {
  return (
    input.providerPreference.includes("firecrawl")
    && input.providerAvailability.firecrawl !== false
  );
}

export function selectExternalIntelligenceProvider(
  input: ExternalIntelligenceRoutingInput,
): ExternalIntelligenceRoutingDecision {
  if (input.requiresManagedMonitoring === true) {
    if (firecrawlAvailable(input)) {
      return {
        provider: "firecrawl",
        capability: "managed-monitor",
        requiresApproval: false,
        rationale:
          "Managed change monitoring requires Firecrawl monitor semantics; use an approved read-only Firecrawl mission rather than a polling browser loop.",
      };
    }
    return {
      provider: "manual-review",
      capability: "managed-monitor",
      requiresApproval: true,
      rationale:
        "Managed monitoring was requested but Firecrawl is unavailable or not approved in the provider preference; do not silently substitute browser automation.",
    };
  }

  if (input.requiresSiteMapping === true) {
    if (firecrawlAvailable(input)) {
      return {
        provider: "firecrawl",
        capability: "site-map",
        requiresApproval: false,
        rationale:
          "Site structure discovery is routed to Firecrawl map so URL discovery can happen before higher-cost scraping or crawling.",
      };
    }
    return {
      provider: "manual-review",
      capability: "site-map",
      requiresApproval: true,
      rationale:
        "Site mapping was requested but Firecrawl is unavailable or not approved; stop for review rather than expanding crawl scope implicitly.",
    };
  }

  const provider = selectAcquisitionProvider({
    requiresJavascript: input.requiresJavascript,
    requiresStatefulBrowser: input.requiresStatefulBrowser,
    knownStaticSource: input.knownStaticSource,
    providerPreference: input.providerPreference,
    providerAvailability: input.providerAvailability,
  });

  return {
    provider,
    capability: "standard-acquisition",
    requiresApproval: provider === "manual-review",
    rationale:
      provider === "native-http"
        ? "Static public source can use the lowest-cost acquisition lane."
        : provider === "crawlee"
          ? "JavaScript-capable self-managed crawling is sufficient."
          : provider === "firecrawl"
            ? "Managed extraction is justified after lower-cost acquisition lanes were not sufficient."
            : provider === "browserless"
              ? "Managed browser execution is required by the requested page behavior."
              : "No approved automated provider is available.",
  };
}
