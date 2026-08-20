import { type AcquisitionProvider } from "../web-acquisition-policy.js";
import { selectExternalIntelligenceProvider } from "../external-intelligence-routing.js";

interface SelectProviderArgs {
  requiresJavascript?: boolean;
  requiresStatefulBrowser?: boolean;
  knownStaticSource?: boolean;
  requiresSiteMapping?: boolean;
  requiresManagedMonitoring?: boolean;
  providerPreference?: AcquisitionProvider[];
  providerAvailability?: Partial<Record<AcquisitionProvider, boolean>>;
}

const DEFAULT_PROVIDER_PREFERENCE: AcquisitionProvider[] = [
  "native-http",
  "crawlee",
  "firecrawl",
  "browserless",
  "manual-review",
];

export async function handle(args: SelectProviderArgs | undefined) {
  const providerPreference: AcquisitionProvider[] =
    args?.providerPreference ?? DEFAULT_PROVIDER_PREFERENCE;

  const decision = selectExternalIntelligenceProvider({
    requiresJavascript: args?.requiresJavascript === true,
    requiresStatefulBrowser: args?.requiresStatefulBrowser === true,
    knownStaticSource: args?.knownStaticSource === true,
    requiresSiteMapping: args?.requiresSiteMapping === true,
    requiresManagedMonitoring: args?.requiresManagedMonitoring === true,
    providerPreference,
    providerAvailability: args?.providerAvailability ?? {},
  });

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            provider: decision.provider,
            capability: decision.capability,
            requiresApproval: decision.requiresApproval,
            rationale: decision.rationale,
          },
          null,
          2,
        ),
      },
    ],
  };
}
