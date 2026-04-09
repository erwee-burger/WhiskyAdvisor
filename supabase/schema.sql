create table if not exists distilleries (
  id text primary key,
  name text not null,
  country text not null,
  region text not null,
  founded_year int,
  notes text
);

create table if not exists bottlers (
  id text primary key,
  name text not null,
  bottler_kind text not null check (bottler_kind in ('official', 'independent')),
  country text,
  notes text
);

create table if not exists expressions (
  id text primary key,
  name text not null,
  brand text,
  distillery_id text not null references distilleries(id),
  bottler_id text not null references bottlers(id),
  bottler_kind text not null check (bottler_kind in ('official', 'independent')),
  release_series text,
  whisky_type text not null,
  country text not null,
  region text not null,
  abv numeric not null,
  age_statement int,
  is_nas boolean not null default false,
  vintage_year int,
  distilled_year int,
  bottled_year int,
  volume_ml int,
  cask_type text,
  cask_number text,
  bottle_number int,
  outturn int,
  barcode text,
  peat_level text not null,
  cask_influence text not null,
  is_chill_filtered boolean not null default false,
  is_natural_color boolean not null default false,
  is_limited boolean not null default false,
  flavor_tags jsonb not null default '[]'::jsonb,
  description text,
  image_url text
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
  opened_date date,
  finished_date date,
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

create table if not exists citations (
  id text primary key,
  entity_type text not null,
  entity_id text not null,
  field text not null,
  label text not null,
  url text not null,
  source_kind text not null,
  confidence numeric not null,
  snippet text,
  created_at timestamptz not null default now()
);

create table if not exists price_snapshots (
  id text primary key,
  expression_id text not null references expressions(id),
  refreshed_at timestamptz not null,
  retail jsonb,
  auction jsonb
);

create table if not exists intake_drafts (
  id text primary key,
  collection_item_id text not null,
  matched_expression_id text,
  source text not null check (source in ('photo', 'barcode', 'hybrid')),
  barcode text,
  raw_expression jsonb not null default '{}'::jsonb,
  identification jsonb,
  review_items jsonb not null default '[]'::jsonb,
  expression jsonb not null default '{}'::jsonb,
  collection jsonb not null default '{}'::jsonb,
  suggestions jsonb not null default '[]'::jsonb,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
