begin;

create or replace function public.normalize_tag_text(input_text text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(lower(btrim(coalesce(input_text, ''))), '[^a-z0-9]+', '-', 'g'), '');
$$;

alter table if exists expressions
  add column if not exists distillery_name text,
  add column if not exists bottler_name text,
  add column if not exists tags text[] not null default '{}'::text[];

update expressions e
set distillery_name = d.name
from distilleries d
where e.distillery_id = d.id
  and (e.distillery_name is null or btrim(e.distillery_name) = '');

update expressions e
set bottler_name = b.name
from bottlers b
where e.bottler_id = b.id
  and (e.bottler_name is null or btrim(e.bottler_name) = '');

update expressions
set tags = (
  select coalesce(array_agg(distinct tag order by tag), '{}'::text[])
  from unnest(
    coalesce(expressions.tags, '{}'::text[])
    || case
      when whisky_type is null or btrim(whisky_type) = '' then '{}'::text[]
      else array[normalize_tag_text(whisky_type)]
    end
    || case
      when peat_level is null or btrim(peat_level) = '' then '{}'::text[]
      when lower(btrim(peat_level)) in ('unpeated', 'un-peated', 'none', 'no peat') then array['unpeated']
      when lower(btrim(peat_level)) in ('light', 'lightly peated', 'medium', 'medium peated', 'peated') then array['peated']
      when lower(btrim(peat_level)) in ('heavy', 'heavily peated', 'heavily-peated') then array['heavily-peated']
      else array[normalize_tag_text(peat_level)]
    end
    || case
      when cask_influence is null or btrim(cask_influence) = '' then '{}'::text[]
      when lower(btrim(cask_influence)) in ('bourbon', 'bourbon cask', 'ex-bourbon') then array['bourbon-cask']
      when lower(btrim(cask_influence)) in ('sherry', 'sherry cask', 'oloroso', 'fino', 'amontillado', 'px') then array['sherry-cask']
      when lower(btrim(cask_influence)) in ('wine', 'wine cask', 'madeira', 'port', 'red wine') then array['wine-cask']
      when lower(btrim(cask_influence)) in ('rum', 'rum cask') then array['rum-cask']
      when lower(btrim(cask_influence)) in ('virgin oak', 'virgin-oak') then array['virgin-oak']
      when lower(btrim(cask_influence)) in ('mixed', 'mixed cask') then array['mixed-cask']
      when lower(btrim(cask_influence)) in ('refill', 'refill cask') then array['refill-cask']
      else array[normalize_tag_text(cask_influence)]
    end
    || case when lower(coalesce(bottler_kind, '')) = 'independent' then array['independent-bottler'] else '{}'::text[] end
    || case when coalesce(is_nas, false) then array['nas'] else '{}'::text[] end
    || case when coalesce(is_limited, false) then array['limited'] else '{}'::text[] end
    || case when coalesce(is_natural_color, false) then array['natural-colour'] else '{}'::text[] end
    || case when coalesce(is_chill_filtered, false) then array['chill-filtered'] else '{}'::text[] end
    || case when release_series is not null and btrim(release_series) <> '' then array[normalize_tag_text(release_series)] else '{}'::text[] end
    || case when cask_type is not null and btrim(cask_type) <> '' then array[normalize_tag_text(cask_type)] else '{}'::text[] end
    || case when cask_number is not null and btrim(cask_number) <> '' then array[normalize_tag_text('cask-' || cask_number)] else '{}'::text[] end
    || case when bottle_number is not null then array[normalize_tag_text('bottle-' || bottle_number::text)] else '{}'::text[] end
    || case when outturn is not null then array[normalize_tag_text('outturn-' || outturn::text)] else '{}'::text[] end
    || case when vintage_year is not null then array[normalize_tag_text(vintage_year::text || '-vintage')] else '{}'::text[] end
    || case when distilled_year is not null then array[normalize_tag_text(distilled_year::text || '-distilled')] else '{}'::text[] end
    || case when bottled_year is not null then array[normalize_tag_text(bottled_year::text || '-bottled')] else '{}'::text[] end
    || case when volume_ml is not null then array[normalize_tag_text(volume_ml::text || 'ml')] else '{}'::text[] end
    || case
      when flavor_tags is not null and jsonb_typeof(flavor_tags) = 'array' then (
        select coalesce(array_agg(normalize_tag_text(value)), '{}'::text[])
        from jsonb_array_elements_text(flavor_tags) as value
      )
      else '{}'::text[]
    end
  ) as tag
  where tag is not null and btrim(tag) <> ''
);

alter table if exists intake_drafts
  add column if not exists raw_ai_response jsonb not null default '{}'::jsonb;

update intake_drafts
set raw_ai_response = case
  when raw_ai_response is not null and raw_ai_response <> '{}'::jsonb then raw_ai_response
  else jsonb_build_object(
    'identificationText',
    case
      when identification is not null then identification::text
      when raw_expression is not null then raw_expression::text
      else null
    end,
    'enrichmentText',
    case
      when raw_expression is not null then raw_expression::text
      else null
    end
  )
end
where raw_ai_response = '{}'::jsonb or raw_ai_response is null;

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
