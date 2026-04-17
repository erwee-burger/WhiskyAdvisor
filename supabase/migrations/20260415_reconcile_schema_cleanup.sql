begin;

-- Reconcile live projects with the flat schema used by lib/supabase-store.ts.
-- This is intentionally idempotent so it can clean up projects that still have
-- legacy columns or tables after earlier schema iterations.

alter table if exists expressions
  add column if not exists distillery_name text,
  add column if not exists bottler_name text,
  add column if not exists brand text,
  add column if not exists country text,
  add column if not exists abv numeric,
  add column if not exists age_statement int,
  add column if not exists barcode text,
  add column if not exists description text,
  add column if not exists image_url text,
  add column if not exists tags text[] default '{}'::text[];

update expressions
set tags = '{}'::text[]
where tags is null;

alter table if exists expressions
  alter column tags set default '{}'::text[],
  alter column tags set not null;

alter table if exists collection_items
  add column if not exists rating int check (rating between 1 and 3),
  add column if not exists is_favorite boolean not null default false;

alter table if exists intake_drafts
  add column if not exists source text,
  add column if not exists barcode text,
  add column if not exists raw_ai_response jsonb default '{}'::jsonb,
  add column if not exists expression jsonb default '{}'::jsonb,
  add column if not exists collection jsonb default '{}'::jsonb;

update intake_drafts
set source = 'photo'
where source is null or btrim(source) = '';

update intake_drafts
set raw_ai_response = '{}'::jsonb
where raw_ai_response is null;

update intake_drafts
set expression = '{}'::jsonb
where expression is null;

update intake_drafts
set collection = '{}'::jsonb
where collection is null;

alter table if exists intake_drafts
  alter column source set not null,
  alter column raw_ai_response set default '{}'::jsonb,
  alter column raw_ai_response set not null,
  alter column expression set default '{}'::jsonb,
  alter column expression set not null,
  alter column collection set default '{}'::jsonb,
  alter column collection set not null;

alter table if exists intake_drafts
  drop constraint if exists intake_drafts_source_check;

alter table if exists intake_drafts
  add constraint intake_drafts_source_check
  check (source in ('photo', 'barcode', 'hybrid', 'search'));

alter table if exists intake_drafts
  drop column if exists matched_expression_id,
  drop column if exists raw_expression,
  drop column if exists identification,
  drop column if exists review_items,
  drop column if exists suggestions,
  drop column if exists citations;

alter table if exists expressions
  drop column if exists distillery_id,
  drop column if exists bottler_id,
  drop column if exists bottler_kind,
  drop column if exists release_series,
  drop column if exists whisky_type,
  drop column if exists region,
  drop column if exists vintage_year,
  drop column if exists distilled_year,
  drop column if exists bottled_year,
  drop column if exists volume_ml,
  drop column if exists cask_type,
  drop column if exists cask_number,
  drop column if exists bottle_number,
  drop column if exists outturn,
  drop column if exists peat_level,
  drop column if exists cask_influence,
  drop column if exists is_nas,
  drop column if exists is_chill_filtered,
  drop column if exists is_natural_color,
  drop column if exists is_limited,
  drop column if exists flavor_tags;

alter table if exists collection_items
  drop column if exists opened_date,
  drop column if exists finished_date;

drop table if exists citations;
drop table if exists price_snapshots;
drop table if exists distilleries;
drop table if exists bottlers;

commit;
