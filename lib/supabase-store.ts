import { createClient } from "@supabase/supabase-js";

import type { IntakeDraft, WhiskyStore } from "@/lib/types";

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const asNumber = Number(value);
  return Number.isNaN(asNumber) ? undefined : asNumber;
}

function toIsoDate(value: unknown) {
  if (!value) return undefined;
  return String(value);
}

function quoteIds(ids: string[]) {
  return ids.map((id) => `"${id.replaceAll("\"", "\\\"")}"`).join(",");
}

async function deleteRowsNotInIds(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  table: string,
  ids: string[],
  key = "id"
) {
  const response =
    ids.length > 0
      ? await supabase.from(table).delete().not(key, "in", `(${quoteIds(ids)})`)
      : await supabase.from(table).delete().neq(key, "");

  if (response.error) {
    throw response.error;
  }
}

export function isSupabaseStoreEnabled() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function readStoreFromSupabase(): Promise<WhiskyStore> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const [
    distilleriesRes,
    bottlersRes,
    expressionsRes,
    itemsRes,
    tastingsRes,
    imagesRes,
    citationsRes,
    pricesRes,
    draftsRes
  ] = await Promise.all([
    supabase.from("distilleries").select("*"),
    supabase.from("bottlers").select("*"),
    supabase.from("expressions").select("*"),
    supabase.from("collection_items").select("*"),
    supabase.from("tasting_entries").select("*"),
    supabase.from("item_images").select("*"),
    supabase.from("citations").select("*"),
    supabase.from("price_snapshots").select("*"),
    supabase.from("intake_drafts").select("*").order("created_at", { ascending: false })
  ]);

  const responses = [
    distilleriesRes,
    bottlersRes,
    expressionsRes,
    itemsRes,
    tastingsRes,
    imagesRes,
    citationsRes,
    pricesRes,
    draftsRes
  ];

  const firstError = responses.find((entry) => entry.error)?.error;
  if (firstError) {
    throw firstError;
  }

  return {
    distilleries: (distilleriesRes.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      country: row.country,
      region: row.region,
      foundedYear: toNumber(row.founded_year),
      notes: row.notes ?? undefined
    })),
    bottlers: (bottlersRes.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      bottlerKind: row.bottler_kind,
      country: row.country ?? undefined,
      notes: row.notes ?? undefined
    })),
    expressions: (expressionsRes.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      brand: row.brand ?? undefined,
      distilleryId: row.distillery_id,
      bottlerId: row.bottler_id,
      bottlerKind: row.bottler_kind,
      whiskyType: row.whisky_type,
      releaseSeries: row.release_series ?? undefined,
      country: row.country,
      region: row.region,
      abv: toNumber(row.abv) ?? 0,
      ageStatement: toNumber(row.age_statement),
      isNas: Boolean(row.is_nas),
      vintageYear: toNumber(row.vintage_year),
      distilledYear: toNumber(row.distilled_year),
      bottledYear: toNumber(row.bottled_year),
      volumeMl: toNumber(row.volume_ml),
      caskType: row.cask_type ?? undefined,
      caskNumber: row.cask_number ?? undefined,
      bottleNumber: toNumber(row.bottle_number),
      outturn: toNumber(row.outturn),
      barcode: row.barcode ?? undefined,
      peatLevel: row.peat_level,
      caskInfluence: row.cask_influence,
      isChillFiltered: Boolean(row.is_chill_filtered),
      isNaturalColor: Boolean(row.is_natural_color),
      isLimited: Boolean(row.is_limited),
      flavorTags: Array.isArray(row.flavor_tags) ? row.flavor_tags : [],
      description: row.description ?? undefined,
      imageUrl: row.image_url ?? undefined
    })),
    collectionItems: (itemsRes.data ?? []).map((row) => ({
      id: row.id,
      expressionId: row.expression_id,
      status: row.status,
      fillState: row.fill_state,
      purchasePrice: toNumber(row.purchase_price),
      purchaseCurrency: row.purchase_currency,
      purchaseDate: toIsoDate(row.purchase_date),
      purchaseSource: row.purchase_source ?? undefined,
      openedDate: toIsoDate(row.opened_date),
      finishedDate: toIsoDate(row.finished_date),
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
    citations: (citationsRes.data ?? []).map((row) => ({
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      field: row.field,
      label: row.label,
      url: row.url,
      sourceKind: row.source_kind,
      confidence: toNumber(row.confidence) ?? 0,
      snippet: row.snippet ?? undefined,
      createdAt: row.created_at
    })),
    priceSnapshots: (pricesRes.data ?? []).map((row) => ({
      id: row.id,
      expressionId: row.expression_id,
      refreshedAt: row.refreshed_at,
      retail: row.retail ?? undefined,
      auction: row.auction ?? undefined
    })),
    drafts: (draftsRes.data ?? []).map((row) => ({
      id: row.id,
      collectionItemId: row.collection_item_id,
      matchedExpressionId: row.matched_expression_id ?? undefined,
      source: row.source,
      barcode: row.barcode ?? undefined,
      rawExpression: row.raw_expression ?? {},
      identification: row.identification ?? undefined,
      reviewItems: Array.isArray(row.review_items) ? row.review_items : [],
      expression: row.expression ?? {},
      collection: row.collection ?? {},
      suggestions: Array.isArray(row.suggestions) ? row.suggestions : [],
      citations: Array.isArray(row.citations) ? row.citations : []
    })) as IntakeDraft[]
  };
}

export async function writeStoreToSupabase(store: WhiskyStore) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const distilleriesUpsert = await supabase.from("distilleries").upsert(
    store.distilleries.map((entry) => ({
      id: entry.id,
      name: entry.name,
      country: entry.country,
      region: entry.region,
      founded_year: entry.foundedYear ?? null,
      notes: entry.notes ?? null
    })),
    { onConflict: "id" }
  );
  if (distilleriesUpsert.error) throw distilleriesUpsert.error;

  const bottlersUpsert = await supabase.from("bottlers").upsert(
    store.bottlers.map((entry) => ({
      id: entry.id,
      name: entry.name,
      bottler_kind: entry.bottlerKind,
      country: entry.country ?? null,
      notes: entry.notes ?? null
    })),
    { onConflict: "id" }
  );
  if (bottlersUpsert.error) throw bottlersUpsert.error;

  const expressionsUpsert = await supabase.from("expressions").upsert(
    store.expressions.map((entry) => ({
      id: entry.id,
      name: entry.name,
      brand: entry.brand ?? null,
      distillery_id: entry.distilleryId,
      bottler_id: entry.bottlerId,
      bottler_kind: entry.bottlerKind,
      release_series: entry.releaseSeries ?? null,
      whisky_type: entry.whiskyType,
      country: entry.country,
      region: entry.region,
      abv: entry.abv,
      age_statement: entry.ageStatement ?? null,
      is_nas: entry.isNas,
      vintage_year: entry.vintageYear ?? null,
      distilled_year: entry.distilledYear ?? null,
      bottled_year: entry.bottledYear ?? null,
      volume_ml: entry.volumeMl ?? null,
      cask_type: entry.caskType ?? null,
      cask_number: entry.caskNumber ?? null,
      bottle_number: entry.bottleNumber ?? null,
      outturn: entry.outturn ?? null,
      barcode: entry.barcode ?? null,
      peat_level: entry.peatLevel,
      cask_influence: entry.caskInfluence,
      is_chill_filtered: entry.isChillFiltered,
      is_natural_color: entry.isNaturalColor,
      is_limited: entry.isLimited,
      flavor_tags: entry.flavorTags,
      description: entry.description ?? null,
      image_url: entry.imageUrl ?? null
    })),
    { onConflict: "id" }
  );
  if (expressionsUpsert.error) throw expressionsUpsert.error;

  const collectionItemsUpsert = await supabase.from("collection_items").upsert(
    store.collectionItems.map((entry) => ({
      id: entry.id,
      expression_id: entry.expressionId,
      status: entry.status,
      fill_state: entry.fillState,
      purchase_price: entry.purchasePrice ?? null,
      purchase_currency: entry.purchaseCurrency,
      purchase_date: entry.purchaseDate ?? null,
      purchase_source: entry.purchaseSource ?? null,
      opened_date: entry.openedDate ?? null,
      finished_date: entry.finishedDate ?? null,
      personal_notes: entry.personalNotes ?? null,
      created_at: entry.createdAt,
      updated_at: entry.updatedAt
    })),
    { onConflict: "id" }
  );
  if (collectionItemsUpsert.error) throw collectionItemsUpsert.error;

  const tastingsUpsert = await supabase.from("tasting_entries").upsert(
    store.tastingEntries.map((entry) => ({
      id: entry.id,
      collection_item_id: entry.collectionItemId,
      tasted_at: entry.tastedAt,
      nose: entry.nose,
      palate: entry.palate,
      finish: entry.finish,
      overall_note: entry.overallNote,
      rating: entry.rating
    })),
    { onConflict: "id" }
  );
  if (tastingsUpsert.error) throw tastingsUpsert.error;

  const imagesUpsert = await supabase.from("item_images").upsert(
    store.itemImages.map((entry) => ({
      id: entry.id,
      collection_item_id: entry.collectionItemId,
      kind: entry.kind,
      url: entry.url,
      label: entry.label ?? null
    })),
    { onConflict: "id" }
  );
  if (imagesUpsert.error) throw imagesUpsert.error;

  const citationsUpsert = await supabase.from("citations").upsert(
    store.citations.map((entry) => ({
      id: entry.id,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      field: entry.field,
      label: entry.label,
      url: entry.url,
      source_kind: entry.sourceKind,
      confidence: entry.confidence,
      snippet: entry.snippet ?? null,
      created_at: entry.createdAt
    })),
    { onConflict: "id" }
  );
  if (citationsUpsert.error) throw citationsUpsert.error;

  const priceSnapshotsUpsert = await supabase.from("price_snapshots").upsert(
    store.priceSnapshots.map((entry) => ({
      id: entry.id,
      expression_id: entry.expressionId,
      refreshed_at: entry.refreshedAt,
      retail: entry.retail ?? null,
      auction: entry.auction ?? null
    })),
    { onConflict: "id" }
  );
  if (priceSnapshotsUpsert.error) throw priceSnapshotsUpsert.error;

  const draftRowsDetailed = store.drafts.map((entry) => ({
    id: entry.id,
    collection_item_id: entry.collectionItemId,
    matched_expression_id: entry.matchedExpressionId ?? null,
    source: entry.source,
    barcode: entry.barcode ?? null,
    raw_expression: entry.rawExpression ?? {},
    identification: entry.identification ?? null,
    review_items: entry.reviewItems,
    expression: entry.expression,
    collection: entry.collection,
    suggestions: entry.suggestions,
    citations: entry.citations
  }));

  let draftUpsert = await supabase.from("intake_drafts").upsert(draftRowsDetailed, { onConflict: "id" });

  if (draftUpsert.error) {
    const draftRowsLegacy = store.drafts.map((entry) => ({
      id: entry.id,
      collection_item_id: entry.collectionItemId,
      matched_expression_id: entry.matchedExpressionId ?? null,
      source: entry.source,
      barcode: entry.barcode ?? null,
      expression: entry.expression,
      collection: entry.collection,
      suggestions: entry.suggestions,
      citations: entry.citations
    }));

    draftUpsert = await supabase.from("intake_drafts").upsert(draftRowsLegacy, { onConflict: "id" });
  }

  if (draftUpsert.error) {
    throw draftUpsert.error;
  }

  await deleteRowsNotInIds(supabase, "intake_drafts", store.drafts.map((entry) => entry.id));
  await deleteRowsNotInIds(
    supabase,
    "tasting_entries",
    store.tastingEntries.map((entry) => entry.id)
  );
  await deleteRowsNotInIds(
    supabase,
    "item_images",
    store.itemImages.map((entry) => entry.id)
  );
  await deleteRowsNotInIds(
    supabase,
    "collection_items",
    store.collectionItems.map((entry) => entry.id)
  );
  await deleteRowsNotInIds(
    supabase,
    "price_snapshots",
    store.priceSnapshots.map((entry) => entry.id)
  );
  await deleteRowsNotInIds(supabase, "citations", store.citations.map((entry) => entry.id));
  await deleteRowsNotInIds(supabase, "expressions", store.expressions.map((entry) => entry.id));
  await deleteRowsNotInIds(supabase, "bottlers", store.bottlers.map((entry) => entry.id));
  await deleteRowsNotInIds(
    supabase,
    "distilleries",
    store.distilleries.map((entry) => entry.id)
  );
}
