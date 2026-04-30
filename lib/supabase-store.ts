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

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
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

function buildGroupMemberRows(store: WhiskyStore) {
  return (store.tastingGroups ?? []).flatMap((group) =>
    group.memberPersonIds.map((personId) => ({
      id: `grp_member_${group.id}_${personId}`,
      group_id: group.id,
      person_id: personId
    }))
  );
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
 * Fetches data from all store tables and transforms to WhiskyStore format.
 * @returns Complete store with expressions, collection items, tastings, images, and drafts
 * @throws Error if Supabase is not configured or read operations fail
 */
export async function readStoreFromSupabase(): Promise<WhiskyStore> {
  const supabase = getSupabaseClient() as SupabaseClientLike | null;
  if (!supabase) throw new Error("Supabase is not configured.");

  const [
    expressionsRes,
    itemsRes,
    imagesRes,
    draftsRes,
    tastingPeopleRes,
    tastingGroupsRes,
    tastingGroupMembersRes,
    tastingPlacesRes,
    tastingSessionsRes,
    tastingSessionAttendeesRes,
    tastingSessionBottlesRes,
    expressionFlavorProfilesRes
  ] = await Promise.all([
    supabase.from("expressions").select("*"),
    supabase.from("collection_items").select("*"),
    supabase.from("item_images").select("*"),
    supabase.from("intake_drafts").select("*"),
    supabase.from("tasting_people").select("*"),
    supabase.from("tasting_groups").select("*"),
    supabase.from("tasting_group_members").select("*"),
    supabase.from("tasting_places").select("*"),
    supabase.from("tasting_sessions").select("*"),
    supabase.from("tasting_session_attendees").select("*"),
    supabase.from("tasting_session_bottles").select("*"),
    supabase.from("expression_flavor_profiles").select("*")
  ]);

  for (const res of [
    expressionsRes,
    itemsRes,
    imagesRes,
    draftsRes,
    tastingPeopleRes,
    tastingGroupsRes,
    tastingGroupMembersRes,
    tastingPlacesRes,
    tastingSessionsRes,
    tastingSessionAttendeesRes,
    tastingSessionBottlesRes,
    expressionFlavorProfilesRes
  ]) {
    if (res.error) throw res.error;
  }

  const groupMembersByGroupId = new Map<string, string[]>();
  for (const row of (tastingGroupMembersRes.data ?? []) as SupabaseRow[]) {
    const groupId = typeof row.group_id === "string" ? row.group_id : null;
    const personId = typeof row.person_id === "string" ? row.person_id : null;

    if (!groupId || !personId) {
      continue;
    }

    const existing = groupMembersByGroupId.get(groupId) ?? [];
    existing.push(personId);
    groupMembersByGroupId.set(groupId, existing);
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
      tastingNotes: toStringArray(row.tasting_notes),
      tags: Array.isArray(row.tags)
        ? row.tags.filter((tag): tag is string => typeof tag === "string")
        : []
    })),
    expressionFlavorProfiles: ((expressionFlavorProfilesRes.data ?? []) as SupabaseRow[]).map((row) => ({
      id: String(row.id),
      expressionId: String(row.expression_id),
      pillars:
        row.pillars && typeof row.pillars === "object"
          ? (row.pillars as WhiskyStore["expressionFlavorProfiles"][number]["pillars"])
          : {
              smoky: 0,
              sweet: 0,
              spicy: 0,
              fruity: 0,
              oaky: 0,
              floral: 0,
              malty: 0,
              coastal: 0
            },
      topNotes: toStringArray(row.top_notes),
      confidence: toNumber(row.confidence) ?? 0,
      evidenceCount: toNumber(row.evidence_count) ?? 0,
      explanation: typeof row.explanation === "string" ? row.explanation : "",
      scoringVersion: typeof row.scoring_version === "string" ? row.scoring_version : "v1",
      modelVersion: typeof row.model_version === "string" ? row.model_version : "deterministic-v1",
      generatedAt: typeof row.generated_at === "string" ? row.generated_at : new Date().toISOString(),
      staleAt: typeof row.stale_at === "string" ? row.stale_at : undefined,
      createdAt: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString()
    })),
    collectionItems: ((itemsRes.data ?? []) as SupabaseRow[]).map((row) => ({
      id: String(row.id),
      expressionId: String(row.expression_id),
      status: row.status === "wishlist" ? "wishlist" : "owned",
      fillState:
        row.fill_state === "open" || row.fill_state === "finished" ? row.fill_state : "sealed",
      purchasePrice: toNumber(row.purchase_price),
      purchaseCurrency:
        typeof row.purchase_currency === "string" ? row.purchase_currency : undefined,
      purchaseDate: typeof row.purchase_date === "string" ? row.purchase_date : undefined,
      purchaseSource: typeof row.purchase_source === "string" ? row.purchase_source : undefined,
      personalNotes: typeof row.personal_notes === "string" ? row.personal_notes : undefined,
      rating: row.rating === 1 || row.rating === 2 || row.rating === 3 ? row.rating : undefined,
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
    tastingEntries: [],
    tastingPeople: ((tastingPeopleRes.data ?? []) as SupabaseRow[]).map((row) => ({
      id: String(row.id),
      name: String(row.name ?? "Unknown person"),
      relationshipType:
        row.relationship_type === "friend" ||
        row.relationship_type === "family" ||
        row.relationship_type === "colleague"
          ? row.relationship_type
          : "other",
      preferenceTags: [...new Set(toStringArray(row.preference_tags))],
      notes: typeof row.notes === "string" ? row.notes : undefined,
      createdAt: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString()
    })),
    tastingGroups: ((tastingGroupsRes.data ?? []) as SupabaseRow[]).map((row) => ({
      id: String(row.id),
      name: String(row.name ?? "Unnamed group"),
      notes: typeof row.notes === "string" ? row.notes : undefined,
      memberPersonIds: [...new Set(groupMembersByGroupId.get(String(row.id)) ?? [])],
      createdAt: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString()
    })),
    tastingPlaces: ((tastingPlacesRes.data ?? []) as SupabaseRow[]).map((row) => ({
      id: String(row.id),
      name: String(row.name ?? "Unnamed place"),
      notes: typeof row.notes === "string" ? row.notes : undefined,
      createdAt: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString()
    })),
    tastingSessions: ((tastingSessionsRes.data ?? []) as SupabaseRow[]).map((row) => ({
      id: String(row.id),
      title: typeof row.title === "string" ? row.title : undefined,
      occasionType:
        row.occasion_type === "visit" || row.occasion_type === "whisky_friday"
          ? row.occasion_type
          : "other",
      sessionDate:
        typeof row.session_date === "string" ? row.session_date : new Date().toISOString(),
      placeId: typeof row.place_id === "string" ? row.place_id : undefined,
      groupId: typeof row.group_id === "string" ? row.group_id : undefined,
      notes: typeof row.notes === "string" ? row.notes : undefined,
      createdAt: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString()
    })),
    tastingSessionAttendees: ((tastingSessionAttendeesRes.data ?? []) as SupabaseRow[]).map(
      (row) => ({
        id: String(row.id),
        sessionId: String(row.session_id),
        personId: String(row.person_id)
      })
    ),
    tastingSessionBottles: ((tastingSessionBottlesRes.data ?? []) as SupabaseRow[]).map((row) => ({
      id: String(row.id),
      sessionId: String(row.session_id),
      collectionItemId: String(row.collection_item_id)
    })),
    drafts: ((draftsRes.data ?? []) as SupabaseRow[]).map((row) => ({
      id: String(row.id),
      collectionItemId: String(row.collection_item_id),
      source:
        row.source === "barcode" || row.source === "hybrid" || row.source === "search"
          ? row.source
          : "photo",
      barcode: typeof row.barcode === "string" ? row.barcode : undefined,
      rawAiResponse:
        row.raw_ai_response && typeof row.raw_ai_response === "object"
          ? (row.raw_ai_response as { identificationText?: string; enrichmentText?: string })
          : undefined,
      expression:
        row.expression && typeof row.expression === "object"
          ? (row.expression as WhiskyStore["drafts"][number]["expression"])
          : { name: "Unknown", tags: [], tastingNotes: [] },
      collection:
        row.collection && typeof row.collection === "object"
          ? (row.collection as WhiskyStore["drafts"][number]["collection"])
          : {}
    }))
  };
}

/**
 * Writes the complete whisky store to Supabase.
 * Upserts all store tables and deletes any rows not in the current store.
 * @param store - The WhiskyStore to persist
 * @throws Error if Supabase is not configured or write operations fail
 * @note Not transactional - if a write fails partway through, database may be in inconsistent state
 */
export async function writeStoreToSupabase(store: WhiskyStore) {
  const supabase = getSupabaseClient() as SupabaseClientLike | null;
  if (!supabase) throw new Error("Supabase is not configured.");

  function throwIfError(results: Array<{ error: unknown }>) {
    for (const res of results) {
      if (res.error) throw res.error;
    }
  }

  // Wave 1: tables with no FK dependencies on other store tables
  const wave1 = await Promise.all([
    supabase.from("expressions").upsert(
      store.expressions.map((expression) => ({
        id: expression.id,
        name: expression.name,
        distillery_name: expression.distilleryName ?? null,
        bottler_name: expression.bottlerName ?? null,
        brand: expression.brand ?? null,
        country: expression.country ?? null,
        abv: expression.abv ?? null,
        age_statement: expression.ageStatement ?? null,
        barcode: expression.barcode ?? null,
        description: expression.description ?? null,
        image_url: expression.imageUrl ?? null,
        tasting_notes: expression.tastingNotes,
        tags: expression.tags
      })),
      { onConflict: "id" }
    ),
    supabase.from("intake_drafts").upsert(
      store.drafts.map((draft) => ({
        id: draft.id,
        collection_item_id: draft.collectionItemId,
        source: draft.source,
        barcode: draft.barcode ?? null,
        raw_ai_response: draft.rawAiResponse ?? {},
        expression: draft.expression ?? { name: "Unknown", tags: [], tastingNotes: [] },
        collection: draft.collection ?? {}
      })),
      { onConflict: "id" }
    ),
    supabase.from("tasting_people").upsert(
      (store.tastingPeople ?? []).map((person) => ({
        id: person.id,
        name: person.name,
        relationship_type: person.relationshipType,
        preference_tags: person.preferenceTags,
        notes: person.notes ?? null,
        created_at: person.createdAt,
        updated_at: person.updatedAt
      })),
      { onConflict: "id" }
    ),
    supabase.from("tasting_groups").upsert(
      (store.tastingGroups ?? []).map((group) => ({
        id: group.id,
        name: group.name,
        notes: group.notes ?? null,
        created_at: group.createdAt,
        updated_at: group.updatedAt
      })),
      { onConflict: "id" }
    ),
    supabase.from("tasting_places").upsert(
      (store.tastingPlaces ?? []).map((place) => ({
        id: place.id,
        name: place.name,
        notes: place.notes ?? null,
        created_at: place.createdAt,
        updated_at: place.updatedAt
      })),
      { onConflict: "id" }
    ),
  ]);
  throwIfError(wave1);

  // Wave 2: tables that depend on wave 1
  const groupMemberRows = buildGroupMemberRows(store);
  const wave2 = await Promise.all([
    supabase.from("collection_items").upsert(
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
    ),
    supabase.from("expression_flavor_profiles").upsert(
      store.expressionFlavorProfiles.map((profile) => ({
        id: profile.id,
        expression_id: profile.expressionId,
        pillars: profile.pillars,
        top_notes: profile.topNotes,
        confidence: profile.confidence,
        evidence_count: profile.evidenceCount,
        explanation: profile.explanation,
        scoring_version: profile.scoringVersion,
        model_version: profile.modelVersion,
        generated_at: profile.generatedAt,
        stale_at: profile.staleAt ?? null,
        created_at: profile.createdAt,
        updated_at: profile.updatedAt
      })),
      { onConflict: "id" }
    ),
    supabase.from("tasting_group_members").upsert(groupMemberRows, { onConflict: "id" }),
    supabase.from("tasting_sessions").upsert(
      (store.tastingSessions ?? []).map((session) => ({
        id: session.id,
        title: session.title ?? null,
        occasion_type: session.occasionType,
        session_date: session.sessionDate,
        place_id: session.placeId ?? null,
        group_id: session.groupId ?? null,
        notes: session.notes ?? null,
        created_at: session.createdAt,
        updated_at: session.updatedAt
      })),
      { onConflict: "id" }
    ),
  ]);
  throwIfError(wave2);

  // Wave 3: tables that depend on wave 2
  const wave3 = await Promise.all([
    supabase.from("item_images").upsert(
      store.itemImages.map((img) => ({
        id: img.id,
        collection_item_id: img.collectionItemId,
        kind: img.kind,
        url: img.url,
        label: img.label ?? null
      })),
      { onConflict: "id" }
    ),
    supabase.from("tasting_session_attendees").upsert(
      (store.tastingSessionAttendees ?? []).map((attendee) => ({
        id: attendee.id,
        session_id: attendee.sessionId,
        person_id: attendee.personId
      })),
      { onConflict: "id" }
    ),
    supabase.from("tasting_session_bottles").upsert(
      (store.tastingSessionBottles ?? []).map((bottle) => ({
        id: bottle.id,
        session_id: bottle.sessionId,
        collection_item_id: bottle.collectionItemId
      })),
      { onConflict: "id" }
    ),
  ]);
  throwIfError(wave3);

  // Delete wave 1: leaf tables (no dependents)
  await Promise.all([
    deleteRowsNotInIds(supabase, "tasting_session_bottles", (store.tastingSessionBottles ?? []).map((e) => e.id)),
    deleteRowsNotInIds(supabase, "tasting_session_attendees", (store.tastingSessionAttendees ?? []).map((e) => e.id)),
    deleteRowsNotInIds(supabase, "tasting_group_members", groupMemberRows.map((e) => e.id)),
    deleteRowsNotInIds(supabase, "item_images", store.itemImages.map((e) => e.id)),
    deleteRowsNotInIds(supabase, "expression_flavor_profiles", store.expressionFlavorProfiles.map((e) => e.id)),
    deleteRowsNotInIds(supabase, "intake_drafts", store.drafts.map((e) => e.id)),
  ]);

  // Delete wave 2: mid-level tables
  await Promise.all([
    deleteRowsNotInIds(supabase, "tasting_sessions", (store.tastingSessions ?? []).map((e) => e.id)),
    deleteRowsNotInIds(supabase, "tasting_people", (store.tastingPeople ?? []).map((e) => e.id)),
    deleteRowsNotInIds(supabase, "tasting_groups", (store.tastingGroups ?? []).map((e) => e.id)),
    deleteRowsNotInIds(supabase, "tasting_places", (store.tastingPlaces ?? []).map((e) => e.id)),
    deleteRowsNotInIds(supabase, "collection_items", store.collectionItems.map((e) => e.id)),
  ]);

  // Delete wave 3: root tables
  await Promise.all([
    deleteRowsNotInIds(supabase, "expressions", store.expressions.map((e) => e.id)),
  ]);
}
