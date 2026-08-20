import assert from "node:assert/strict";
import { selectExternalIntelligenceProvider } from "../dist/external-intelligence-routing.js";

const defaults = {
  requiresJavascript: false,
  requiresStatefulBrowser: false,
  knownStaticSource: false,
  providerPreference: ["native-http", "crawlee", "firecrawl", "browserless", "manual-review"],
  providerAvailability: {
    "native-http": true,
    crawlee: true,
    firecrawl: true,
    browserless: true,
    "manual-review": true,
  },
};

const mapped = selectExternalIntelligenceProvider({
  ...defaults,
  requiresSiteMapping: true,
});
assert.equal(mapped.provider, "firecrawl");
assert.equal(mapped.capability, "site-map");
assert.equal(mapped.requiresApproval, false);

const monitored = selectExternalIntelligenceProvider({
  ...defaults,
  requiresManagedMonitoring: true,
});
assert.equal(monitored.provider, "firecrawl");
assert.equal(monitored.capability, "managed-monitor");
assert.equal(monitored.requiresApproval, false);

const monitorWithoutFirecrawl = selectExternalIntelligenceProvider({
  ...defaults,
  requiresManagedMonitoring: true,
  providerAvailability: { ...defaults.providerAvailability, firecrawl: false },
});
assert.equal(monitorWithoutFirecrawl.provider, "manual-review");
assert.equal(monitorWithoutFirecrawl.requiresApproval, true);

const mapWithoutApproval = selectExternalIntelligenceProvider({
  ...defaults,
  requiresSiteMapping: true,
  providerPreference: ["native-http", "crawlee", "browserless", "manual-review"],
});
assert.equal(mapWithoutApproval.provider, "manual-review");
assert.equal(mapWithoutApproval.requiresApproval, true);

const staticSource = selectExternalIntelligenceProvider({
  ...defaults,
  knownStaticSource: true,
});
assert.equal(staticSource.provider, "native-http");
assert.equal(staticSource.capability, "standard-acquisition");

const javascriptSource = selectExternalIntelligenceProvider({
  ...defaults,
  requiresJavascript: true,
});
assert.equal(javascriptSource.provider, "crawlee");

const statefulSource = selectExternalIntelligenceProvider({
  ...defaults,
  requiresJavascript: true,
  requiresStatefulBrowser: true,
});
assert.equal(statefulSource.provider, "firecrawl");

console.log(JSON.stringify({
  ok: true,
  mapProvider: mapped.provider,
  monitorProvider: monitored.provider,
  unavailableMonitorFallback: monitorWithoutFirecrawl.provider,
  staticProvider: staticSource.provider,
  javascriptProvider: javascriptSource.provider,
  statefulProvider: statefulSource.provider,
}, null, 2));
