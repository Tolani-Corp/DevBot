# DevBot Tenant-Safe Retrieval Migration

## Release boundary

Migration `0004_tenant_safe_retrieval.sql` changes the existing `documents` and `document_embeddings` tables in place but does not authorize production cutover by itself.

Existing rows are assigned to `legacy-unassigned`, marked `restricted`, and require the `legacy:quarantine` access scope. They remain unavailable to normal tenants until an operator maps each document to the correct tenant/workspace and replaces the quarantine scope.

## Required deployment sequence

1. Take and verify a PostgreSQL backup.
2. Inventory all existing document owners and workspace mappings.
3. Apply the migration in non-production.
4. Run `pnpm test -- tests/retrieval-isolation.test.ts`.
5. Verify cross-tenant reads fail both through RLS and through `assertCandidateAuthorized`.
6. Map quarantined legacy rows to an approved tenant and workspace in controlled batches.
7. Set `app.tenant_id` transaction-locally before every retrieval query.
8. Compare approximate HNSW results against exact search for each large tenant.
9. Register any replacement embedding model as `shadow`; dual-write and benchmark before cutover.
10. Obtain explicit migration approval before production execution.

## Query contract

`search_document_embeddings` requires the requested tenant, product, granted scopes, maximum sensitivity, embedding profile, and query vector. The requested tenant must match the transaction-local `app.tenant_id` value.

The function returns only active documents/chunks whose required scopes are a subset of granted scopes and whose sensitivity does not exceed the caller clearance.

## Prohibited shortcuts

- Do not map all legacy rows to a real customer tenant.
- Do not disable RLS to work around missing session context.
- Do not relabel existing vectors as a new embedding model.
- Do not activate a shadow profile without exact-recall and tenant-isolation evidence.
