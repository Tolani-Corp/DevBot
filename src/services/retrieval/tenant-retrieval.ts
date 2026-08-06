import { z } from "zod";

export const SensitivitySchema = z.enum(["public", "internal", "confidential", "restricted"]);
export const LifecycleSchema = z.enum(["active", "superseded", "revoked", "deleted"]);

export const RetrievalContextSchema = z.object({
  tenantId: z.string().min(1),
  workspaceId: z.string().min(1).optional(),
  productId: z.string().min(1).default("devbot"),
  collectionIds: z.array(z.string().min(1)).default([]),
  accessScopes: z.array(z.string().min(1)).min(1),
  maximumSensitivity: SensitivitySchema.default("internal"),
  actorId: z.string().min(1).optional(),
});

export const EmbeddingProfileSchema = z.object({
  profileId: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  modelVersion: z.string().min(1),
  dimensions: z.number().int().positive(),
  distanceMetric: z.enum(["cosine", "inner-product", "l2"]),
  normalization: z.enum(["unit", "none"]),
  status: z.enum(["active", "shadow", "deprecated", "retired"]),
});

export const RetrievalCandidateSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  workspaceId: z.string().min(1).nullable().optional(),
  productId: z.string().min(1),
  collectionId: z.string().min(1),
  accessScopes: z.array(z.string().min(1)).min(1),
  sensitivity: SensitivitySchema,
  lifecycle: LifecycleSchema,
  embeddingProfileId: z.string().min(1),
});

export type RetrievalContext = z.infer<typeof RetrievalContextSchema>;
export type RetrievalCandidate = z.infer<typeof RetrievalCandidateSchema>;
export type EmbeddingProfile = z.infer<typeof EmbeddingProfileSchema>;

const sensitivityRank: Record<z.infer<typeof SensitivitySchema>, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  restricted: 3,
};

export function createRetrievalContext(input: unknown): RetrievalContext {
  return RetrievalContextSchema.parse(input);
}

export function assertCandidateAuthorized(candidateInput: unknown, contextInput: unknown): RetrievalCandidate {
  const candidate = RetrievalCandidateSchema.parse(candidateInput);
  const context = RetrievalContextSchema.parse(contextInput);
  if (candidate.lifecycle !== "active") throw new Error("Retrieval candidate is not active");
  if (candidate.tenantId !== context.tenantId) throw new Error("Retrieval candidate tenant mismatch");
  if (context.workspaceId && candidate.workspaceId && candidate.workspaceId !== context.workspaceId) throw new Error("Retrieval candidate workspace mismatch");
  if (candidate.productId !== context.productId) throw new Error("Retrieval candidate product mismatch");
  if (context.collectionIds.length > 0 && !context.collectionIds.includes(candidate.collectionId)) throw new Error("Retrieval candidate collection is not authorized");
  const granted = new Set(context.accessScopes);
  if (!candidate.accessScopes.every((scope) => granted.has(scope))) throw new Error("Retrieval candidate scope requirement is not satisfied");
  if (sensitivityRank[candidate.sensitivity] > sensitivityRank[context.maximumSensitivity]) throw new Error("Retrieval candidate exceeds sensitivity clearance");
  return candidate;
}

export function buildTenantSessionStatement(contextInput: unknown) {
  const context = RetrievalContextSchema.parse(contextInput);
  return {
    sql: "select set_config('app.tenant_id', $1, true)",
    parameters: [context.tenantId],
  } as const;
}

export function assertEmbeddingMigration({ from, to }: { from: EmbeddingProfile; to: EmbeddingProfile }) {
  const source = EmbeddingProfileSchema.parse(from);
  const target = EmbeddingProfileSchema.parse(to);
  if (source.profileId === target.profileId && JSON.stringify(source) !== JSON.stringify(target)) {
    throw new Error("Embedding profiles are immutable; create a new profileId");
  }
  if (target.status !== "shadow") throw new Error("A replacement embedding profile must begin in shadow status");
  return {
    dualWriteRequired: true,
    exactRecallBaselineRequired: true,
    tenantIsolationTestRequired: true,
    explicitCutoverRequired: true,
    rollbackProfileId: source.profileId,
    shadowProfileId: target.profileId,
  };
}
