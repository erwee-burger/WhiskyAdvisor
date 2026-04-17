create extension if not exists pgcrypto;

create table if not exists expressions (
  id text primary key,
  name text not null,
  distillery_name text,
  bottler_name text,
  brand text,
  country text,
  abv numeric,
  age_statement int,
  barcode text,
  description text,
  image_url text,
  tags text[] not null default '{}'::text[]
);

create table if not exists collection_items (
  id text primary key,
  expression_id text not null references expressions(id),
  status text not null check (status in ('owned', 'wishlist')),
  fill_state text not null check (fill_state in ('sealed', 'open', 'finished')),
  purchase_price numeric,
  purchase_currency text not null default 'ZAR',
  purchase_date date,
  purchase_source text,
  personal_notes text,
  rating int check (rating between 1 and 3),
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists item_images (
  id text primary key,
  collection_item_id text not null references collection_items(id) on delete cascade,
  kind text not null check (kind in ('front', 'back', 'detail')),
  url text not null,
  label text
);

create table if not exists intake_drafts (
  id text primary key,
  collection_item_id text not null,
  source text not null check (source in ('photo', 'barcode', 'hybrid', 'search')),
  barcode text,
  raw_ai_response jsonb not null default '{}'::jsonb,
  expression jsonb not null default '{}'::jsonb,
  collection jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists news_refreshes (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('pending', 'success', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_text text
);

create index if not exists news_refreshes_completed_at_idx
  on news_refreshes (completed_at desc);

create table if not exists news_items (
  id uuid primary key default gen_random_uuid(),
  refresh_id uuid not null references news_refreshes(id) on delete cascade,
  source text not null,
  kind text not null check (kind in ('special', 'new_release')),
  name text not null,
  price numeric not null,
  original_price numeric,
  discount_pct integer,
  url text not null,
  image_url text,
  in_stock boolean not null default true,
  relevance_score integer not null default 50,
  why_it_matters text,
  citations jsonb not null default '[]'::jsonb
);

create index if not exists news_items_refresh_relevance_idx
  on news_items (refresh_id, relevance_score desc);

create table if not exists news_summary_cards (
  id uuid primary key default gen_random_uuid(),
  refresh_id uuid not null references news_refreshes(id) on delete cascade,
  card_type text not null check (card_type in ('best_value', 'worth_stretching', 'most_interesting')),
  title text not null,
  subtitle text,
  price numeric,
  url text,
  why_it_matters text,
  source text
);

create table if not exists news_preferences (
  id integer primary key default 1 check (id = 1),
  soft_budget_cap_zar numeric not null default 1000,
  stretch_budget_cap_zar numeric,
  updated_at timestamptz not null default now()
);

create table if not exists news_seen_state (
  id integer primary key default 1 check (id = 1),
  seen_keys jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists tasting_people (
  id text primary key,
  name text not null,
  relationship_type text not null check (relationship_type in ('friend', 'family', 'colleague', 'other')),
  preference_tags text[] not null default '{}'::text[],
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tasting_groups (
  id text primary key,
  name text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tasting_group_members (
  id text primary key,
  group_id text not null references tasting_groups(id) on delete cascade,
  person_id text not null references tasting_people(id) on delete cascade
);

create unique index if not exists tasting_group_members_group_person_idx
  on tasting_group_members (group_id, person_id);

create table if not exists tasting_places (
  id text primary key,
  name text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tasting_sessions (
  id text primary key,
  title text,
  occasion_type text not null check (occasion_type in ('visit', 'whisky_friday', 'other')),
  session_date timestamptz not null,
  place_id text references tasting_places(id) on delete set null,
  group_id text references tasting_groups(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasting_sessions_session_date_idx
  on tasting_sessions (session_date desc);

create table if not exists tasting_session_attendees (
  id text primary key,
  session_id text not null references tasting_sessions(id) on delete cascade,
  person_id text not null references tasting_people(id) on delete cascade
);

create unique index if not exists tasting_session_attendees_session_person_idx
  on tasting_session_attendees (session_id, person_id);

create table if not exists tasting_session_bottles (
  id text primary key,
  session_id text not null references tasting_sessions(id) on delete cascade,
  collection_item_id text not null references collection_items(id) on delete cascade
);

create unique index if not exists tasting_session_bottles_session_item_idx
  on tasting_session_bottles (session_id, collection_item_id);
