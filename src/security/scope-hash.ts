import crypto from "node:crypto";

import type { NetworkScopePolicy } from "./network-scope.js";

export function normalizedScope(scope: NetworkScopePolicy): Required<NetworkScopePolicy> {
  return {
    inScope: [...new Set(scope.inScope.map((entry) => entry.trim()).filter(Boolean))].sort(),
    outOfScope: [...new Set(scope.outOfScope.map((entry) => entry.trim()).filter(Boolean))].sort(),
    allowedPorts: [...new Set(scope.allowedPorts ?? [])].sort((left, right) => left - right),
    allowedPaths: [...new Set((scope.allowedPaths ?? []).map((entry) => entry.trim()).filter(Boolean))].sort(),
    includeSubdomains: scope.includeSubdomains,
  };
}

export function scopeHash(scope: NetworkScopePolicy): string {
  return crypto.createHash("sha256").update(JSON.stringify(normalizedScope(scope))).digest("hex");
}
