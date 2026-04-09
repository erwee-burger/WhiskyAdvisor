alter table collection_items
  add column if not exists rating int check (rating between 1 and 3),
  add column if not exists is_favorite boolean not null default false;
