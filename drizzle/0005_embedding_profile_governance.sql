-- DevBot's current vector storage is fixed at 1,536 dimensions.
-- A dimensionality change requires a separate shadow table/column migration and cannot be represented by relabeling this index.

alter table embedding_profiles
  drop constraint if exists embedding_profiles_devbot_dimensions_check;
alter table embedding_profiles
  add constraint embedding_profiles_devbot_dimensions_check check (dimensions = 1536);

alter table embedding_profiles add column if not exists identity_digest_sha256 text;
alter table embedding_profiles add column if not exists transition_evidence_digest_sha256 text;
alter table embedding_profiles add column if not exists transitioned_at timestamptz;

update embedding_profiles
set identity_digest_sha256 = encode(
  digest(
    concat_ws('|', provider, model, model_version, dimensions::text, distance_metric, normalization),
    'sha256'
  ),
  'hex'
)
where identity_digest_sha256 is null;

alter table embedding_profiles alter column identity_digest_sha256 set not null;
alter table embedding_profiles
  drop constraint if exists embedding_profiles_identity_digest_check;
alter table embedding_profiles
  add constraint embedding_profiles_identity_digest_check check (identity_digest_sha256 ~ '^[a-f0-9]{64}$');
alter table embedding_profiles
  drop constraint if exists embedding_profiles_transition_evidence_check;
alter table embedding_profiles
  add constraint embedding_profiles_transition_evidence_check check (
    transition_evidence_digest_sha256 is null
    or transition_evidence_digest_sha256 ~ '^[a-f0-9]{64}$'
  );

create table if not exists embedding_profile_transition_events (
  id bigint generated always as identity primary key,
  profile_id text not null references embedding_profiles(profile_id),
  from_status text not null check (from_status in ('active', 'shadow', 'deprecated', 'retired')),
  to_status text not null check (to_status in ('active', 'shadow', 'deprecated', 'retired')),
  evidence_digest_sha256 text not null check (evidence_digest_sha256 ~ '^[a-f0-9]{64}$'),
  exact_recall_at_10 real,
  ndcg_at_10 real,
  tenant_violation_count integer not null default 0 check (tenant_violation_count >= 0),
  actor_id text not null,
  occurred_at timestamptz not null default now(),
  check (
    (from_status = 'shadow' and to_status in ('active', 'retired'))
    or (from_status = 'active' and to_status = 'deprecated')
    or (from_status = 'deprecated' and to_status = 'retired')
  ),
  check (
    not (from_status = 'shadow' and to_status = 'active')
    or (
      exact_recall_at_10 >= 0.95
      and ndcg_at_10 >= 0.90
      and tenant_violation_count = 0
    )
  )
);

create index if not exists idx_embedding_profile_transition_events_profile
  on embedding_profile_transition_events (profile_id, occurred_at desc);

comment on table embedding_profile_transition_events is
  'Append-only evidence for shadow activation, deprecation, retirement, recall quality, and tenant-isolation results.';
