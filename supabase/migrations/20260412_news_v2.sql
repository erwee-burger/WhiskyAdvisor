-- Drop v1 upsert-model table (no cascade needed; no FK refs from other tables)
drop table if exists news_items cascade;

-- Refresh log: one row per refresh attempt
create table news_refreshes (
  id           uuid primary key default gen_random_uuid(),
  status       text not null check (status in ('pending', 'success', 'failed')),
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  error_text   text
);

-- Items linked to a refresh; cascade delete removes orphan items automatically
create table news_items (
  id              uuid primary key default gen_random_uuid(),
  refresh_id      uuid not null references news_refreshes(id) on delete cascade,
  source          text not null,
  kind            text not null check (kind in ('special', 'new_release')),
  name            text not null,
  price           numeric not null,
  original_price  numeric,
  discount_pct    integer,
  url             text not null,
  image_url       text,
  in_stock        boolean not null default true,
  relevance_score integer not null default 50,
  why_it_matters  text,
  citations       jsonb not null default '[]'
);

-- Up to 3 summary cards per refresh
create table news_summary_cards (
  id             uuid primary key default gen_random_uuid(),
  refresh_id     uuid not null references news_refreshes(id) on delete cascade,
  card_type      text not null check (card_type in ('best_value', 'worth_stretching', 'most_interesting')),
  title          text not null,
  subtitle       text,
  price          numeric,
  url            text,
  why_it_matters text,
  source         text
);

-- Single-row budget preferences; id=1 enforced by check constraint
create table news_preferences (
  id                     integer primary key default 1 check (id = 1),
  soft_budget_cap_zar    numeric not null default 1000,
  stretch_budget_cap_zar numeric,
  updated_at             timestamptz not null default now()
);
