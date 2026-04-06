alter table if exists expressions
  add column if not exists brand text;

alter table if exists expressions
  add column if not exists volume_ml int;

alter table if exists expressions
  add column if not exists is_nas boolean not null default false;

alter table if exists expressions
  add column if not exists is_chill_filtered boolean not null default false;

alter table if exists expressions
  add column if not exists is_natural_color boolean not null default false;

alter table if exists expressions
  add column if not exists is_limited boolean not null default false;

update expressions
set is_nas = case
  when age_statement is null then true
  when lower(age_statement::text) like '%nas%' then true
  else false
end;

alter table if exists expressions
  alter column age_statement type integer
  using nullif(regexp_replace(coalesce(age_statement::text, ''), '[^0-9]', '', 'g'), '')::integer;

alter table if exists expressions
  alter column bottle_number type integer
  using nullif((regexp_match(coalesce(bottle_number::text, ''), '([0-9]+)'))[1], '')::integer;

alter table if exists expressions
  alter column outturn type integer
  using nullif((regexp_match(coalesce(outturn::text, ''), '([0-9]+)'))[1], '')::integer;
