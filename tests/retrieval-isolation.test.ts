import { describe, expect, it } from "vitest";
import {
  assertCandidateAuthorized,
  assertEmbeddingMigration,
  buildTenantSessionStatement,
  createRetrievalContext,
} from "../src/services/retrieval/tenant-retrieval.js";

const context = createRetrievalContext({
  tenantId: "tenant-a",
  workspaceId: "workspace-a",
  productId: "devbot",
  collectionIds: ["repo-a"],
  accessScopes: ["knowledge:read", "repo:a"],
  maximumSensitivity: "confidential",
});

const candidate = {
  id: "chunk-1",
  tenantId: "tenant-a",
  workspaceId: "workspace-a",
  productId: "devbot",
  collectionId: "repo-a",
  accessScopes: ["knowledge:read"],
  sensitivity: "internal" as const,
  lifecycle: "active" as const,
  embeddingProfileId: "legacy-1536-v1",
};

describe("tenant-safe retrieval", () => {
  it("accepts only candidates inside tenant, workspace, collection, scopes, and sensitivity", () => {
    expect(assertCandidateAuthorized(candidate, context)).toEqual(candidate);
    expect(() => assertCandidateAuthorized({ ...candidate, tenantId: "tenant-b" }, context)).toThrow(/tenant mismatch/);
    expect(() => assertCandidateAuthorized({ ...candidate, accessScopes: ["admin"] }, context)).toThrow(/scope requirement/);
    expect(() => assertCandidateAuthorized({ ...candidate, sensitivity: "restricted" }, context)).toThrow(/sensitivity clearance/);
    expect(() => assertCandidateAuthorized({ ...candidate, lifecycle: "revoked" }, context)).toThrow(/not active/);
  });

  it("builds a transaction-local tenant session statement", () => {
    expect(buildTenantSessionStatement(context)).toEqual({ sql: "select set_config('app.tenant_id', $1, true)", parameters: ["tenant-a"] });
  });

  it("requires shadow indexing and explicit cutover for embedding changes", () => {
    const source = { profileId: "general-v1", provider: "p", model: "m", modelVersion: "1", dimensions: 1536, distanceMetric: "cosine" as const, normalization: "unit" as const, status: "active" as const };
    const target = { ...source, profileId: "general-v2", modelVersion: "2", status: "shadow" as const };
    expect(assertEmbeddingMigration({ from: source, to: target })).toMatchObject({ dualWriteRequired: true, explicitCutoverRequired: true });
    expect(() => assertEmbeddingMigration({ from: source, to: { ...target, status: "active" } })).toThrow(/shadow status/);
  });
});
