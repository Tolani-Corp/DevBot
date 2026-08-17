# DevBot Tenant-Safe Retrieval Migration

## Release boundary

Migrations `0004_tenant_safe_retrieval.sql` and `0005_embedding_profile_governance.sql` change the existing retrieval storage but do not authorize production cutover by themselves.

Existing rows are assigned to `legacy-unassigned`, marked `restricted`, and require the `legacy:quarantine` access scope. They remain unavailable to normal tenants until an operator maps each document to the correct tenant/workspace and replaces the quarantine scope.

## Required deployment sequence

1. Take and verify a PostgreSQL backup.
2. Inventory all existing document owners and workspace mappings.
3. Apply `0004_tenant_safe_retrieval.sql` in non-production.
4. Apply `0005_embedding_profile_governance.sql` in non-production.
5. Run `pnpm test -- tests/retrieval-isolation.test.ts` and `pnpm check`.
6. Verify cross-tenant reads fail both through RLS and through `assertCandidateAuthorized`.
7. Map quarantined legacy rows to an approved tenant and workspace in controlled batches.
8. Set `app.tenant_id` transaction-locally before every retrieval query.
9. Compare approximate HNSW results against exact search for each large tenant.
10. Register any replacement embedding model as `shadow`; dual-write and benchmark before cutover.
11. Require Recall@10 >= 0.95, nDCG@10 >= 0.90, and zero tenant violations before a shadow profile can become active.
12. Obtain explicit migration approval before production execution.

## Query contract

`search_document_embeddings` requires the requested tenant, product, granted scopes, maximum sensitivity, embedding profile, and query vector. The requested tenant must match the transaction-local `app.tenant_id` value.

The function returns only active documents/chunks whose required scopes are a subset of granted scopes and whose sensitivity does not exceed the caller clearance.

## GitHub validation gate

The branch must have CI runs against its current head SHA with actual step-level logs. Historical `startup_failure`, cancelled, or zero-job suites do not satisfy the gate. A documentation-only synchronization commit may be used to retrigger the pull-request workflow after organization Actions execution is restored, but no production migration proceeds solely because a workflow starts.

## Prohibited shortcuts

- Do not map all legacy rows to a real customer tenant.
- Do not disable RLS to work around missing session context.
- Do not relabel existing vectors as a new embedding model.
- Do not attach a non-1536 profile to the current `vector(1536)` storage.
- Do not activate a shadow profile without exact-recall, nDCG, and tenant-isolation evidence.
- Do not promote quarantined knowledge or enable production retrieval as part of this migration.
