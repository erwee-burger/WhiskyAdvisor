create table if not exists news_seen_state (
  id         integer primary key default 1 check (id = 1),
  seen_keys  jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
