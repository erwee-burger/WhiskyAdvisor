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
      distilleryId: row.distillery_id,
      bottlerId: row.bottler_id,
      bottlerKind: row.bottler_kind,
      whiskyType: row.whisky_type,
      releaseSeries: row.release_series ?? undefined,
      country: row.country,
      region: row.region,
      abv: toNumber(row.abv) ?? 0,
      ageStatement: row.age_statement ?? undefined,
      vintageYear: toNumber(row.vintage_year),
      distilledYear: toNumber(row.distilled_year),
      bottledYear: toNumber(row.bottled_year),
      caskType: row.cask_type ?? undefined,
      caskNumber: row.cask_number ?? undefined,
      bottleNumber: row.bottle_number ?? undefined,
      outturn: row.outturn ?? undefined,
      barcode: row.barcode ?? undefined,
      peatLevel: row.peat_level,
      caskInfluence: row.cask_influence,
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

  const operations = [
    supabase.from("distilleries").upsert(
      store.distilleries.map((entry) => ({
        id: entry.id,
        name: entry.name,
        country: entry.country,
        region: entry.region,
        founded_year: entry.foundedYear ?? null,
        notes: entry.notes ?? null
      })),
      { onConflict: "id" }
    ),
    supabase.from("bottlers").upsert(
      store.bottlers.map((entry) => ({
        id: entry.id,
        name: entry.name,
        bottler_kind: entry.bottlerKind,
        country: entry.country ?? null,
        notes: entry.notes ?? null
      })),
      { onConflict: "id" }
    ),
    supabase.from("expressions").upsert(
      store.expressions.map((entry) => ({
        id: entry.id,
        name: entry.name,
        distillery_id: entry.distilleryId,
        bottler_id: entry.bottlerId,
        bottler_kind: entry.bottlerKind,
        release_series: entry.releaseSeries ?? null,
        whisky_type: entry.whiskyType,
        country: entry.country,
        region: entry.region,
        abv: entry.abv,
        age_statement: entry.ageStatement ?? null,
        vintage_year: entry.vintageYear ?? null,
        distilled_year: entry.distilledYear ?? null,
        bottled_year: entry.bottledYear ?? null,
        cask_type: entry.caskType ?? null,
        cask_number: entry.caskNumber ?? null,
        bottle_number: entry.bottleNumber ?? null,
        outturn: entry.outturn ?? null,
        barcode: entry.barcode ?? null,
        peat_level: entry.peatLevel,
        cask_influence: entry.caskInfluence,
        flavor_tags: entry.flavorTags,
        description: entry.description ?? null,
        image_url: entry.imageUrl ?? null
      })),
      { onConflict: "id" }
    ),
    supabase.from("collection_items").upsert(
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
    ),
    supabase.from("tasting_entries").upsert(
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
    ),
    supabase.from("item_images").upsert(
      store.itemImages.map((entry) => ({
        id: entry.id,
        collection_item_id: entry.collectionItemId,
        kind: entry.kind,
        url: entry.url,
        label: entry.label ?? null
      })),
      { onConflict: "id" }
    ),
    supabase.from("citations").upsert(
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
    ),
    supabase.from("price_snapshots").upsert(
      store.priceSnapshots.map((entry) => ({
        id: entry.id,
        expression_id: entry.expressionId,
        refreshed_at: entry.refreshedAt,
        retail: entry.retail ?? null,
        auction: entry.auction ?? null
      })),
      { onConflict: "id" }
    )
  ];

  const results = await Promise.all(operations);
  const firstError = results.find((entry) => entry.error)?.error;
  if (firstError) {
    throw firstError;
  }

  const draftUpsert = await supabase.from("intake_drafts").upsert(
    store.drafts.map((entry) => ({
      id: entry.id,
      collection_item_id: entry.collectionItemId,
      matched_expression_id: entry.matchedExpressionId ?? null,
      source: entry.source,
      barcode: entry.barcode ?? null,
      expression: entry.expression,
      collection: entry.collection,
      suggestions: entry.suggestions,
      citations: entry.citations
    })),
    { onConflict: "id" }
  );

  if (draftUpsert.error) {
    throw draftUpsert.error;
  }

  const draftIds = store.drafts.map((entry) => entry.id);
  if (draftIds.length > 0) {
    const quotedIds = draftIds.map((id) => `"${id.replaceAll("\"", "\\\"")}"`).join(",");
    const staleDelete = await supabase
      .from("intake_drafts")
      .delete()
      .not("id", "in", `(${quotedIds})`);
    if (staleDelete.error) {
      throw staleDelete.error;
    }
  } else {
    const deleteAll = await supabase.from("intake_drafts").delete().neq("id", "");
    if (deleteAll.error) {
      throw deleteAll.error;
    }
  }
}
