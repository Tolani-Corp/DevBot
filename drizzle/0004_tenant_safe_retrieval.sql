-- DevBot tenant-safe retrieval migration.
-- Existing rows are quarantined under the legacy-unassigned tenant until an explicit workspace mapping is approved.

create table if not exists embedding_profiles (
  profile_id text primary key,
  provider text not null,
  model text not null,
  model_version text not null,
  dimensions integer not null check (dimensions > 0),
  distance_metric text not null default 'cosine' check (distance_metric in ('cosine', 'inner-product', 'l2')),
  normalization text not null default 'unit' check (normalization in ('unit', 'none')),
  status text not null default 'shadow' check (status in ('active', 'shadow', 'deprecated', 'retired')),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  retired_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (provider, model, model_version, dimensions, distance_metric, normalization)
);

insert into embedding_profiles (profile_id, provider, model, model_version, dimensions, status, metadata)
values ('legacy-1536-v1', 'legacy', 'unknown-1536', 'pre-registry', 1536, 'active', '{"migration":"0004_tenant_safe_retrieval"}'::jsonb)
on conflict (profile_id) do nothing;

alter table documents add column if not exists tenant_id text;
alter table documents add column if not exists workspace_id text;
alter table documents add column if not exists product_id text;
alter table documents add column if not exists collection_id text;
alter table documents add column if not exists access_scopes text[];
alter table documents add column if not exists sensitivity text;
alter table documents add column if not exists lifecycle text;
alter table documents add column if not exists source_revision text;
alter table documents add column if not exists metadata jsonb;

update documents
set tenant_id = coalesce(nullif(metadata->>'tenantId', ''), 'legacy-unassigned'),
    product_id = coalesce(nullif(product_id, ''), 'devbot'),
    collection_id = coalesce(nullif(collection_id, ''), repository),
    access_scopes = case when access_scopes is null or cardinality(access_scopes) = 0 then array['legacy:quarantine']::text[] else access_scopes end,
    sensitivity = coalesce(nullif(sensitivity, ''), 'restricted'),
    lifecycle = coalesce(nullif(lifecycle, ''), 'active'),
    source_revision = coalesce(nullif(source_revision, ''), last_hash),
    metadata = coalesce(metadata, '{}'::jsonb)
where tenant_id is null
   or product_id is null
   or collection_id is null
   or access_scopes is null
   or sensitivity is null
   or lifecycle is null
   or source_revision is null
   or metadata is null;

alter table documents alter column tenant_id set not null;
alter table documents alter column product_id set not null;
alter table documents alter column collection_id set not null;
alter table documents alter column access_scopes set not null;
alter table documents alter column sensitivity set not null;
alter table documents alter column lifecycle set not null;
alter table documents alter column source_revision set not null;
alter table documents alter column metadata set not null;
alter table documents alter column access_scopes set default array[]::text[];
alter table documents alter column sensitivity set default 'internal';
alter table documents alter column lifecycle set default 'active';
alter table documents alter column metadata set default '{}'::jsonb;

alter table documents drop constraint if exists documents_sensitivity_check;
alter table documents add constraint documents_sensitivity_check check (sensitivity in ('public', 'internal', 'confidential', 'restricted'));
alter table documents drop constraint if exists documents_lifecycle_check;
alter table documents add constraint documents_lifecycle_check check (lifecycle in ('active', 'superseded', 'revoked', 'deleted'));

alter table document_embeddings add column if not exists tenant_id text;
alter table document_embeddings add column if not exists workspace_id text;
alter table document_embeddings add column if not exists product_id text;
alter table document_embeddings add column if not exists collection_id text;
alter table document_embeddings add column if not exists access_scopes text[];
alter table document_embeddings add column if not exists sensitivity text;
alter table document_embeddings add column if not exists lifecycle text;
alter table document_embeddings add column if not exists embedding_profile_id text;
alter table document_embeddings add column if not exists content_hash text;
alter table document_embeddings add column if not exists token_count integer;
alter table document_embeddings add column if not exists section_path text[];
alter table document_embeddings add column if not exists start_offset integer;
alter table document_embeddings add column if not exists end_offset integer;
alter table document_embeddings add column if not exists source_revision text;
alter table document_embeddings add column if not exists metadata jsonb;

update document_embeddings de
set tenant_id = d.tenant_id,
    workspace_id = d.workspace_id,
    product_id = d.product_id,
    collection_id = d.collection_id,
    access_scopes = d.access_scopes,
    sensitivity = d.sensitivity,
    lifecycle = d.lifecycle,
    embedding_profile_id = coalesce(nullif(de.embedding_profile_id, ''), 'legacy-1536-v1'),
    content_hash = coalesce(nullif(de.content_hash, ''), encode(digest(de.content, 'sha256'), 'hex')),
    token_count = coalesce(de.token_count, greatest(1, ceil(length(de.content)::numeric / 4)::integer)),
    section_path = coalesce(de.section_path, array[]::text[]),
    source_revision = coalesce(nullif(de.source_revision, ''), d.source_revision),
    metadata = coalesce(de.metadata, '{}'::jsonb)
from documents d
where d.id = de.document_id;

alter table document_embeddings alter column tenant_id set not null;
alter table document_embeddings alter column product_id set not null;
alter table document_embeddings alter column collection_id set not null;
alter table document_embeddings alter column access_scopes set not null;
alter table document_embeddings alter column sensitivity set not null;
alter table document_embeddings alter column lifecycle set not null;
alter table document_embeddings alter column embedding_profile_id set not null;
alter table document_embeddings alter column content_hash set not null;
alter table document_embeddings alter column token_count set not null;
alter table document_embeddings alter column section_path set not null;
alter table document_embeddings alter column source_revision set not null;
alter table document_embeddings alter column metadata set not null;

alter table document_embeddings alter column access_scopes set default array[]::text[];
alter table document_embeddings alter column sensitivity set default 'internal';
alter table document_embeddings alter column lifecycle set default 'active';
alter table document_embeddings alter column embedding_profile_id set default 'legacy-1536-v1';
alter table document_embeddings alter column section_path set default array[]::text[];
alter table document_embeddings alter column metadata set default '{}'::jsonb;

alter table document_embeddings drop constraint if exists document_embeddings_sensitivity_check;
alter table document_embeddings add constraint document_embeddings_sensitivity_check check (sensitivity in ('public', 'internal', 'confidential', 'restricted'));
alter table document_embeddings drop constraint if exists document_embeddings_lifecycle_check;
alter table document_embeddings add constraint document_embeddings_lifecycle_check check (lifecycle in ('active', 'superseded', 'revoked', 'deleted'));
alter table document_embeddings drop constraint if exists document_embeddings_embedding_profile_fk;
alter table document_embeddings add constraint document_embeddings_embedding_profile_fk foreign key (embedding_profile_id) references embedding_profiles(profile_id);

create index if not exists idx_documents_tenant_collection on documents (tenant_id, product_id, collection_id, lifecycle);
create index if not exists idx_documents_access_scopes on documents using gin (access_scopes);
create index if not exists idx_document_embeddings_tenant_collection on document_embeddings (tenant_id, product_id, collection_id, lifecycle, embedding_profile_id);
create index if not exists idx_document_embeddings_access_scopes on document_embeddings using gin (access_scopes);
create unique index if not exists idx_document_embeddings_versioned_chunk on document_embeddings (tenant_id, document_id, chunk_index, embedding_profile_id);

alter table documents enable row level security;
alter table document_embeddings enable row level security;

create policy documents_tenant_isolation on documents
  using (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

create policy document_embeddings_tenant_isolation on document_embeddings
  using (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

create or replace function search_document_embeddings(
  requested_tenant_id text,
  requested_product_id text,
  granted_scopes text[],
  maximum_sensitivity text,
  query_embedding vector(1536),
  requested_profile_id text default 'legacy-1536-v1',
  match_count integer default 10
)
returns table (
  embedding_id text,
  document_id text,
  content text,
  repository text,
  file_path text,
  similarity real,
  content_hash text,
  source_revision text,
  metadata jsonb
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if requested_tenant_id is null or requested_tenant_id = '' then
    raise exception 'tenant_id is required';
  end if;
  if requested_tenant_id <> nullif(current_setting('app.tenant_id', true), '') then
    raise exception 'tenant context mismatch';
  end if;
  if requested_product_id is null or requested_product_id = '' then
    raise exception 'product_id is required';
  end if;
  if granted_scopes is null or cardinality(granted_scopes) = 0 then
    raise exception 'at least one access scope is required';
  end if;

  return query
  select
    de.id,
    d.id,
    de.content,
    d.repository,
    d.file_path,
    (1 - (de.embedding <=> query_embedding))::real,
    de.content_hash,
    de.source_revision,
    d.metadata || de.metadata
  from document_embeddings de
  join documents d on d.id = de.document_id
  where de.tenant_id = requested_tenant_id
    and de.product_id = requested_product_id
    and de.lifecycle = 'active'
    and d.lifecycle = 'active'
    and de.embedding_profile_id = requested_profile_id
    and de.access_scopes <@ granted_scopes
    and case de.sensitivity
      when 'public' then 0
      when 'internal' then 1
      when 'confidential' then 2
      when 'restricted' then 3
      else 99
    end <= case maximum_sensitivity
      when 'public' then 0
      when 'internal' then 1
      when 'confidential' then 2
      when 'restricted' then 3
      else -1
    end
    and de.embedding is not null
  order by de.embedding <=> query_embedding
  limit greatest(1, least(match_count, 100));
end;
$$;

comment on table embedding_profiles is 'Immutable embedding model profiles. Model or dimension changes require a new profile and shadow index.';
comment on function search_document_embeddings is 'Tenant- and scope-enforced semantic retrieval. The caller must set app.tenant_id in the transaction.';
