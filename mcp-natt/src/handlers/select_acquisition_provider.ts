import {
  selectAcquisitionProvider,
  type AcquisitionProvider,
} from "../web-acquisition-policy.js";

interface SelectProviderArgs {
  requiresJavascript?: boolean;
  requiresStatefulBrowser?: boolean;
  knownStaticSource?: boolean;
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

  const provider = selectAcquisitionProvider({
    requiresJavascript: args?.requiresJavascript === true,
    requiresStatefulBrowser: args?.requiresStatefulBrowser === true,
    knownStaticSource: args?.knownStaticSource === true,
    providerPreference,
    providerAvailability: args?.providerAvailability ?? {},
  });

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            provider,
            requiresApproval: provider === "manual-review",
            rationale:
              provider === "native-http"
                ? "Static public source can use the lowest-cost acquisition lane."
                : provider === "crawlee"
                  ? "JavaScript-capable self-managed crawling is sufficient."
                  : provider === "firecrawl"
                    ? "Managed extraction or stateful browser capability is required."
                    : provider === "browserless"
                      ? "Managed browser execution is required."
                      : "No approved automated provider is available.",
          },
          null,
          2,
        ),
      },
    ],
  };
}
