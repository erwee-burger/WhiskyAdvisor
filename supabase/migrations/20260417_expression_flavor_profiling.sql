alter table expressions
  add column if not exists tasting_notes text[] not null default '{}';

create table if not exists expression_flavor_profiles (
  id text primary key,
  expression_id text not null unique references expressions(id) on delete cascade,
  pillars jsonb not null,
  top_notes text[] not null default '{}',
  confidence numeric not null,
  evidence_count int not null,
  explanation text not null,
  scoring_version text not null,
  model_version text not null,
  generated_at timestamptz not null,
  stale_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expression_flavor_profiles_expression_id_idx
  on expression_flavor_profiles (expression_id);

create index if not exists expression_flavor_profiles_stale_at_idx
  on expression_flavor_profiles (stale_at)
  where stale_at is not null;
