// lib/supabase-store.ts
import { createClient } from "@supabase/supabase-js";
import type { WhiskyStore } from "@/lib/types";

type SupabaseRow = Record<string, unknown>;
type SupabaseResponse = { data: unknown[] | null; error: Error | null };
type SupabaseMutationResponse = { error: Error | null };
type SupabaseDeleteQuery = {
  not(column: string, operator: string, value: string): Promise<SupabaseMutationResponse>;
  neq(column: string, value: string): Promise<SupabaseMutationResponse>;
};
type SupabaseQuery = {
  select(columns?: string): Promise<SupabaseResponse>;
  order(column: string, options?: { ascending?: boolean }): Promise<SupabaseResponse>;
  upsert(values: unknown, options?: { onConflict?: string }): Promise<SupabaseMutationResponse>;
  delete(): SupabaseDeleteQuery;
};
type SupabaseClientLike = {
  from(table: string): SupabaseQuery;
};

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
  supabase: SupabaseClientLike,
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
  const supabase = getSupabaseClient() as SupabaseClientLike | null;
  if (!supabase) throw new Error("Supabase is not configured.");

  const [expressionsRes, itemsRes, imagesRes, draftsRes] = await Promise.all([
    supabase.from("expressions").select("*"),
    supabase.from("collection_items").select("*"),
    supabase.from("item_images").select("*"),
    supabase.from("intake_drafts").select("*")
  ]);

  for (const res of [expressionsRes, itemsRes, imagesRes, draftsRes]) {
    if (res.error) throw res.error;
  }

  return {
    expressions: ((expressionsRes.data ?? []) as SupabaseRow[]).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      distilleryName: typeof row.distillery_name === "string" ? row.distillery_name : undefined,
      bottlerName: typeof row.bottler_name === "string" ? row.bottler_name : undefined,
      brand: typeof row.brand === "string" ? row.brand : undefined,
      country: typeof row.country === "string" ? row.country : undefined,
      abv: toNumber(row.abv),
      ageStatement: toNumber(row.age_statement),
      barcode: typeof row.barcode === "string" ? row.barcode : undefined,
      description: typeof row.description === "string" ? row.description : undefined,
      imageUrl: typeof row.image_url === "string" ? row.image_url : undefined,
      tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === "string") : []
    })),
    collectionItems: ((itemsRes.data ?? []) as SupabaseRow[]).map((row) => ({
      id: String(row.id),
      expressionId: String(row.expression_id),
      status: row.status === "wishlist" ? "wishlist" : "owned",
      fillState:
        row.fill_state === "open" || row.fill_state === "finished" ? row.fill_state : "sealed",
      purchasePrice: toNumber(row.purchase_price),
      purchaseCurrency: typeof row.purchase_currency === "string" ? row.purchase_currency : undefined,
      purchaseDate: typeof row.purchase_date === "string" ? row.purchase_date : undefined,
      purchaseSource: typeof row.purchase_source === "string" ? row.purchase_source : undefined,
      personalNotes: typeof row.personal_notes === "string" ? row.personal_notes : undefined,
      rating: (row.rating === 1 || row.rating === 2 || row.rating === 3) ? row.rating : undefined,
      isFavorite: row.is_favorite === true,
      createdAt: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString()
    })),
    itemImages: ((imagesRes.data ?? []) as SupabaseRow[]).map((row) => ({
      id: String(row.id),
      collectionItemId: String(row.collection_item_id),
      kind: row.kind === "back" || row.kind === "detail" ? row.kind : "front",
      url: String(row.url ?? ""),
      label: typeof row.label === "string" ? row.label : undefined
    })),
    drafts: ((draftsRes.data ?? []) as SupabaseRow[]).map((row) => ({
      id: String(row.id),
      collectionItemId: String(row.collection_item_id),
      source: row.source === "barcode" || row.source === "hybrid" ? row.source : "photo",
      barcode: typeof row.barcode === "string" ? row.barcode : undefined,
      rawAiResponse:
        row.raw_ai_response && typeof row.raw_ai_response === "object"
          ? (row.raw_ai_response as { identificationText?: string; enrichmentText?: string })
          : undefined,
      expression:
        row.expression && typeof row.expression === "object"
          ? (row.expression as WhiskyStore["drafts"][number]["expression"])
          : { name: "Unknown", tags: [] },
      collection:
        row.collection && typeof row.collection === "object"
          ? (row.collection as WhiskyStore["drafts"][number]["collection"])
          : {}
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
  const supabase = getSupabaseClient() as SupabaseClientLike | null;
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
      rating: item.rating ?? null,
      is_favorite: item.isFavorite ?? false,
      created_at: item.createdAt,
      updated_at: item.updatedAt
    })),
    { onConflict: "id" }
  );
  if (itemsUpsert.error) throw itemsUpsert.error;

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
  await deleteRowsNotInIds(supabase, "item_images", store.itemImages.map((img) => img.id));
  await deleteRowsNotInIds(supabase, "collection_items", store.collectionItems.map((item) => item.id));
  await deleteRowsNotInIds(supabase, "expressions", store.expressions.map((e) => e.id));
}
