// lib/supabase-store.ts
import { createClient } from "@supabase/supabase-js";
import type { WhiskyStore } from "@/lib/types";

function getSupabaseClient(): ReturnType<typeof createClient> | null {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

function quoteIds(ids: string[]) {
  return ids.map((id) => `"${id.replaceAll('"', '\\"')}"`).join(",");
}

async function deleteRowsNotInIds(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  table: string,
  ids: string[]
) {
  const response =
    ids.length > 0
      ? await supabase.from(table).delete().not("id", "in", `(${quoteIds(ids)})`)
      : await supabase.from(table).delete().neq("id", "");
  if (response.error) throw response.error;
}

/**
 * Checks if Supabase environment variables are configured.
 * @returns true if both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set
 */
export function isSupabaseStoreEnabled() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Reads the complete whisky store from Supabase.
 * Fetches data from all 5 tables and transforms to WhiskyStore format.
 * @returns Complete store with expressions, collection items, tastings, images, and drafts
 * @throws Error if Supabase is not configured or read operations fail
 */
export async function readStoreFromSupabase(): Promise<WhiskyStore> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const [expressionsRes, itemsRes, tastingsRes, imagesRes, draftsRes] = await Promise.all([
    supabase.from("expressions").select("*"),
    supabase.from("collection_items").select("*"),
    supabase.from("tasting_entries").select("*"),
    supabase.from("item_images").select("*"),
    supabase.from("intake_drafts").select("*").order("created_at", { ascending: false })
  ]);

  for (const res of [expressionsRes, itemsRes, tastingsRes, imagesRes, draftsRes]) {
    if (res.error) throw res.error;
  }

  return {
    expressions: (expressionsRes.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      distilleryName: row.distillery_name ?? undefined,
      bottlerName: row.bottler_name ?? undefined,
      brand: row.brand ?? undefined,
      country: row.country ?? undefined,
      abv: toNumber(row.abv),
      ageStatement: toNumber(row.age_statement),
      barcode: row.barcode ?? undefined,
      description: row.description ?? undefined,
      imageUrl: row.image_url ?? undefined,
      tags: Array.isArray(row.tags) ? row.tags : []
    })),
    collectionItems: (itemsRes.data ?? []).map((row) => ({
      id: row.id,
      expressionId: row.expression_id,
      status: row.status,
      fillState: row.fill_state,
      purchasePrice: toNumber(row.purchase_price),
      purchaseCurrency: row.purchase_currency,
      purchaseDate: row.purchase_date ?? undefined,
      purchaseSource: row.purchase_source ?? undefined,
      personalNotes: row.personal_notes ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })),
    tastingEntries: (tastingsRes.data ?? []).map((row) => ({
      id: row.id,
      collectionItemId: row.collection_item_id,
      tastedAt: row.tasted_at,
      nose: row.nose,
      palate: row.palate,
      finish: row.finish,
      overallNote: row.overall_note,
      rating: row.rating
    })),
    itemImages: (imagesRes.data ?? []).map((row) => ({
      id: row.id,
      collectionItemId: row.collection_item_id,
      kind: row.kind,
      url: row.url,
      label: row.label ?? undefined
    })),
    drafts: (draftsRes.data ?? []).map((row) => ({
      id: row.id,
      collectionItemId: row.collection_item_id,
      source: row.source,
      barcode: row.barcode ?? undefined,
      rawAiResponse: row.raw_ai_response ?? undefined,
      expression: row.expression ?? { name: "Unknown", tags: [] },
      collection: row.collection ?? {}
    }))
  };
}

/**
 * Writes the complete whisky store to Supabase.
 * Upserts all 5 tables and deletes any rows not in the current store.
 * @param store - The WhiskyStore to persist
 * @throws Error if Supabase is not configured or write operations fail
 * @note Not transactional - if a write fails partway through, database may be in inconsistent state
 */
export async function writeStoreToSupabase(store: WhiskyStore) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const expressionsUpsert = await supabase.from("expressions").upsert(
    store.expressions.map((e) => ({
      id: e.id,
      name: e.name,
      distillery_name: e.distilleryName ?? null,
      bottler_name: e.bottlerName ?? null,
      brand: e.brand ?? null,
      country: e.country ?? null,
      abv: e.abv ?? null,
      age_statement: e.ageStatement ?? null,
      barcode: e.barcode ?? null,
      description: e.description ?? null,
      image_url: e.imageUrl ?? null,
      tags: e.tags
    })),
    { onConflict: "id" }
  );
  if (expressionsUpsert.error) throw expressionsUpsert.error;

  const itemsUpsert = await supabase.from("collection_items").upsert(
    store.collectionItems.map((item) => ({
      id: item.id,
      expression_id: item.expressionId,
      status: item.status,
      fill_state: item.fillState,
      purchase_price: item.purchasePrice ?? null,
      purchase_currency: item.purchaseCurrency,
      purchase_date: item.purchaseDate ?? null,
      purchase_source: item.purchaseSource ?? null,
      personal_notes: item.personalNotes ?? null,
      created_at: item.createdAt,
      updated_at: item.updatedAt
    })),
    { onConflict: "id" }
  );
  if (itemsUpsert.error) throw itemsUpsert.error;

  const tastingsUpsert = await supabase.from("tasting_entries").upsert(
    store.tastingEntries.map((t) => ({
      id: t.id,
      collection_item_id: t.collectionItemId,
      tasted_at: t.tastedAt,
      nose: t.nose,
      palate: t.palate,
      finish: t.finish,
      overall_note: t.overallNote,
      rating: t.rating
    })),
    { onConflict: "id" }
  );
  if (tastingsUpsert.error) throw tastingsUpsert.error;

  const imagesUpsert = await supabase.from("item_images").upsert(
    store.itemImages.map((img) => ({
      id: img.id,
      collection_item_id: img.collectionItemId,
      kind: img.kind,
      url: img.url,
      label: img.label ?? null
    })),
    { onConflict: "id" }
  );
  if (imagesUpsert.error) throw imagesUpsert.error;

  const draftsUpsert = await supabase.from("intake_drafts").upsert(
    store.drafts.map((d) => ({
      id: d.id,
      collection_item_id: d.collectionItemId,
      source: d.source,
      barcode: d.barcode ?? null,
      raw_ai_response: d.rawAiResponse ?? null,
      expression: d.expression ?? { name: "Unknown", tags: [] },
      collection: d.collection ?? {}
    })),
    { onConflict: "id" }
  );
  if (draftsUpsert.error) throw draftsUpsert.error;

  await deleteRowsNotInIds(supabase, "intake_drafts", store.drafts.map((d) => d.id));
  await deleteRowsNotInIds(supabase, "tasting_entries", store.tastingEntries.map((t) => t.id));
  await deleteRowsNotInIds(supabase, "item_images", store.itemImages.map((img) => img.id));
  await deleteRowsNotInIds(supabase, "collection_items", store.collectionItems.map((item) => item.id));
  await deleteRowsNotInIds(supabase, "expressions", store.expressions.map((e) => e.id));
}
