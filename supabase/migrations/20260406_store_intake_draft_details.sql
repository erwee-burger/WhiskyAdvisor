alter table if exists intake_drafts
  add column if not exists raw_expression jsonb not null default '{}'::jsonb;

alter table if exists intake_drafts
  add column if not exists identification jsonb;

alter table if exists intake_drafts
  add column if not exists review_items jsonb not null default '[]'::jsonb;
