# Database Cleanup Plan

## What I found

- The runtime store in [lib/supabase-store.ts](/c:/Users/erweeb/Desktop/Whisky/lib/supabase-store.ts) now uses a flat schema plus news and tasting tables.
- The old baseline in [supabase/schema.sql](/c:/Users/erweeb/Desktop/Whisky/supabase/schema.sql) was still describing the pre-flatten schema.
- The migration chain can leave legacy columns behind on `expressions` and `intake_drafts`, and the repo still has docs that assume the old schema.
- Several legacy fields are still accepted by the API input layer (schemas + repository) but silently dropped by the Supabase writer. Any client still posting them gets a one-render mirage before the data vanishes on reload.

## Risks identified

1. **Input-path silent data loss (fix first).** [lib/schemas.ts](/c:/Users/erweeb/Desktop/Whisky/lib/schemas.ts) (`bottlePayloadSchema`, lines 85-104) still validates `releaseSeries`, `bottlerKind`, `whiskyType`, `region`, `volumeMl`, `vintageYear`, `distilledYear`, `bottledYear`, `caskType`, `caskNumber`, `bottleNumber`, `outturn`, `peatLevel`, `caskInfluence`, `isNas`, `isChillFiltered`, `isNaturalColor`, `isLimited`, `flavorTags`. [lib/repository.ts](/c:/Users/erweeb/Desktop/Whisky/lib/repository.ts) `buildExpressionRecord` (lines 187-206) writes them onto the in-memory Expression. [lib/supabase-store.ts](/c:/Users/erweeb/Desktop/Whisky/lib/supabase-store.ts) `writeStoreToSupabase` (lines 279-295) silently drops them on upsert. This is already broken today.
2. **`intake_drafts.raw_ai_response` NOT-NULL regression.** The migration sets `raw_ai_response` to `NOT NULL DEFAULT '{}'::jsonb`, but [lib/supabase-store.ts:336](/c:/Users/erweeb/Desktop/Whisky/lib/supabase-store.ts) writes `draft.rawAiResponse ?? null`. A draft without AI output will throw `null value violates not-null constraint` post-migration. Writer must send `{}` (or the column must stay nullable). Same shape of risk for `expression` and `collection` JSONB columns, though those already have safer fallbacks.
3. **Derived features degrade silently.** [lib/mock-store.ts](/c:/Users/erweeb/Desktop/Whisky/lib/mock-store.ts) `toLegacyTags` (lines 41-107) derives tags like `nas`, `limited`, `chill-filtered`, `bourbon-cask`, `peated` from the legacy fields. Once the fields are gone the only remaining source is whatever OpenAI writes into `tags[]` or manual tag input — verify the intake still emits these tags explicitly or analytics/comparison rows will quietly stop reporting them.
4. **Dead references in advisor/analytics.** [lib/advisor-context.ts:128-162](/c:/Users/erweeb/Desktop/Whisky/lib/advisor-context.ts) reads `e.region`, `e.caskType`, `e.peatLevel`, `e.whiskyType`, `e.vintageYear`, `e.isNas`, etc. — all become permanent `undefined`. [lib/analytics.ts:33](/c:/Users/erweeb/Desktop/Whisky/lib/analytics.ts) reads `expression.volumeMl` for `averageVolumeMl`; `bottleProfile.withVolume` will always be 0.
5. **Backup scope.** A schema-only export does not protect the data if something goes wrong. Take a full database dump (pg_dump or Supabase automated backup) before touching production.
6. **Smoke test is too shallow.** Reads alone won't catch the silent-truncation and NOT-NULL regressions above. Staging must exercise a full write → reload round trip (edit a bottle, save a new draft without AI output, reload) before touching production.
7. **No RLS / grant audit on legacy tables.** Dropping `distilleries`, `bottlers`, `citations`, `price_snapshots` also drops any policies/grants attached. In this repo there are no FKs pointing at them from surviving tables, so the drop itself is safe, but confirm nothing external (dashboards, ad-hoc tools, other services) queries them before removing.

## Safe rollout order

1. **Full data backup** — pg_dump of the production database (not just schema) and verify the dump restores into a scratch project.
2. **Code PR first** — land before migrating prod:
   - Remove legacy fields from `bottlePayloadSchema` in [lib/schemas.ts](/c:/Users/erweeb/Desktop/Whisky/lib/schemas.ts).
   - Remove them from the `BottleRecordPayload` type and `buildExpressionRecord` in [lib/repository.ts](/c:/Users/erweeb/Desktop/Whisky/lib/repository.ts).
   - Remove them from the `Expression` interface in [lib/types.ts](/c:/Users/erweeb/Desktop/Whisky/lib/types.ts).
   - Fix [lib/supabase-store.ts:336](/c:/Users/erweeb/Desktop/Whisky/lib/supabase-store.ts) so `raw_ai_response` is never `null` (send `{}` when absent).
   - Trim dead field reads in [lib/advisor-context.ts](/c:/Users/erweeb/Desktop/Whisky/lib/advisor-context.ts) and the `volumeMl` branch in [lib/analytics.ts](/c:/Users/erweeb/Desktop/Whisky/lib/analytics.ts).
   - Confirm OpenAI intake still emits the tag strings that used to be derived (`nas`, `limited`, `chill-filtered`, cask-family tags, `peated`), or accept the analytics regression and update snapshots.
3. **Apply the cleanup migration in a staging Supabase project:**
   - [supabase/migrations/20260415_reconcile_schema_cleanup.sql](/c:/Users/erweeb/Desktop/Whisky/supabase/migrations/20260415_reconcile_schema_cleanup.sql)
4. **Full round-trip staging test** (not just smoke):
   - add bottle (with and without AI output)
   - edit bottle, reload, confirm persisted fields match what was submitted
   - save draft with empty `rawAiResponse` and confirm no NOT-NULL error
   - load collection, analytics, advisor context
   - news refresh/read
   - tasting create/read
5. **Apply the same migration to production.**
6. After the database is clean, remove the temporary legacy-migration logic in [lib/mock-store.ts](/c:/Users/erweeb/Desktop/Whisky/lib/mock-store.ts) once no local JSON fixtures still need it.

## Candidate legacy columns to verify before drop

- `expressions`: `distillery_id`, `bottler_id`, `bottler_kind`, `release_series`, `whisky_type`, `region`, `vintage_year`, `distilled_year`, `bottled_year`, `volume_ml`, `cask_type`, `cask_number`, `bottle_number`, `outturn`, `peat_level`, `cask_influence`, `is_nas`, `is_chill_filtered`, `is_natural_color`, `is_limited`, `flavor_tags`
- `collection_items`: `opened_date`, `finished_date`
- `intake_drafts`: `matched_expression_id`, `raw_expression`, `identification`, `review_items`, `suggestions`, `citations`
- legacy tables: `distilleries`, `bottlers`, `citations`, `price_snapshots`

## Quick audit queries

```sql
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('expressions', 'collection_items', 'intake_drafts')
order by table_name, ordinal_position;
```

```sql
select tablename
from pg_tables
where schemaname = 'public'
  and tablename in ('distilleries', 'bottlers', 'citations', 'price_snapshots');
```

```sql
-- Confirm nothing outside the app is reading the legacy tables before drop.
select schemaname, relname, seq_scan, idx_scan, n_live_tup
from pg_stat_all_tables
where relname in ('distilleries', 'bottlers', 'citations', 'price_snapshots');
```

## Repo follow-up after DB cleanup

- Confirm no remaining references to the removed fields across `lib/` (search for the field names above).
- Keep `lib/mock-store.ts` legacy migration logic only as long as old local JSON data still needs to be read; remove once all dev fixtures are on the flat shape.
- Update any docs under `docs/` that still describe the pre-flatten schema (grep for `distillery_id`, `flavor_tags`, etc.).
