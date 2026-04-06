create table if not exists news_items (
  id             uuid primary key default gen_random_uuid(),
  source         text not null,
  kind           text not null check (kind in ('special', 'new_release')),
  name           text not null,
  price          numeric not null,
  original_price numeric,
  discount_pct   integer,
  url            text not null,
  image_url      text,
  in_stock       boolean not null default true,
  fetched_at     timestamptz not null default now(),
  unique (source, url)
);
