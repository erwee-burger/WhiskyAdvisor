import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { seedStore } from "@/lib/seed-data";
import {
  isSupabaseStoreEnabled,
  readStoreFromSupabase,
  writeStoreToSupabase
} from "@/lib/supabase-store";
import type {
  CollectionItem,
  Expression,
  IntakeDraft,
  TastingGroup,
  TastingPerson,
  TastingPlace,
  TastingSession,
  TastingSessionAttendee,
  TastingSessionBottle,
  WhiskyStore
} from "@/lib/types";

function toRating(value: unknown): 1 | 2 | 3 | undefined {
  const n = Number(value);
  if (n === 1 || n === 2 || n === 3) return n;
  return undefined;
}

const dataDir = path.join(process.cwd(), "data");
const storePath = path.join(dataDir, "mock-store.json");
const fallbackTimestamp = "2026-04-05T09:00:00.000Z";

function normalizeTag(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toLegacyTags(expression: Record<string, unknown>, flavorTags: unknown) {
  const tags = new Set<string>();
  const add = (value?: string | null) => {
    if (!value) return;
    const normalized = normalizeTag(value);
    if (normalized) {
      tags.add(normalized);
    }
  };

  add(typeof expression.whiskyType === "string" ? expression.whiskyType : null);
  add(typeof expression.peatLevel === "string" ? expression.peatLevel : null);

  const caskInfluence = typeof expression.caskInfluence === "string" ? expression.caskInfluence : null;
  if (caskInfluence === "bourbon") add("bourbon-cask");
  if (caskInfluence === "sherry") add("sherry-cask");
  if (caskInfluence === "wine") add("wine-cask");
  if (caskInfluence === "rum") add("rum-cask");
  if (caskInfluence === "virgin-oak") add("virgin-oak");
  if (caskInfluence === "mixed") add("mixed-cask");
  if (caskInfluence === "refill") add("refill-cask");

  if (expression.bottlerKind === "independent") add("independent-bottler");
  if (expression.isNas === true) add("nas");
  if (expression.isLimited === true) add("limited");
  if (expression.isNaturalColor === true) add("natural-colour");
  if (expression.isChillFiltered === true) add("chill-filtered");

  add(typeof expression.releaseSeries === "string" ? expression.releaseSeries : null);
  add(typeof expression.caskType === "string" ? expression.caskType : null);
  add(
    typeof expression.vintageYear === "number" || typeof expression.vintageYear === "string"
      ? `${expression.vintageYear}-vintage`
      : null
  );
  add(
    typeof expression.distilledYear === "number" || typeof expression.distilledYear === "string"
      ? `${expression.distilledYear}-distilled`
      : null
  );
  add(
    typeof expression.bottledYear === "number" || typeof expression.bottledYear === "string"
      ? `${expression.bottledYear}-bottled`
      : null
  );
  add(
    typeof expression.volumeMl === "number" || typeof expression.volumeMl === "string"
      ? `${expression.volumeMl}ml`
      : null
  );
  add(
    typeof expression.bottleNumber === "number" || typeof expression.bottleNumber === "string"
      ? `bottle-${expression.bottleNumber}`
      : null
  );
  add(
    typeof expression.outturn === "number" || typeof expression.outturn === "string"
      ? `outturn-${expression.outturn}`
      : null
  );
  add(
    typeof expression.caskNumber === "string" && expression.caskNumber
      ? `cask-${expression.caskNumber}`
      : null
  );

  if (Array.isArray(flavorTags)) {
    for (const tag of flavorTags) {
      add(typeof tag === "string" ? tag : null);
    }
  }

  return [...tags];
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isNaN(value) ? undefined : value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return undefined;
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function normalizePreferenceTags(value: unknown) {
  const tags = toStringArray(value)
    .map((entry) => normalizeTag(entry))
    .filter(Boolean);

  return [...new Set(tags)];
}

function normalizeStore(store: WhiskyStore): WhiskyStore {
  const tastingPeople = Array.isArray(store.tastingPeople)
    ? store.tastingPeople.map((entry): TastingPerson => ({
        id: String(entry.id),
        name: String(entry.name ?? "Unknown person"),
        relationshipType:
          entry.relationshipType === "friend" ||
          entry.relationshipType === "family" ||
          entry.relationshipType === "colleague"
            ? entry.relationshipType
            : "other",
        preferenceTags: normalizePreferenceTags(entry.preferenceTags),
        notes: typeof entry.notes === "string" ? entry.notes : undefined,
        createdAt: typeof entry.createdAt === "string" ? entry.createdAt : fallbackTimestamp,
        updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : fallbackTimestamp
      }))
    : [];

  const tastingGroups = Array.isArray(store.tastingGroups)
    ? store.tastingGroups.map((entry): TastingGroup => ({
        id: String(entry.id),
        name: String(entry.name ?? "Unnamed group"),
        notes: typeof entry.notes === "string" ? entry.notes : undefined,
        memberPersonIds: [...new Set(toStringArray(entry.memberPersonIds))],
        createdAt: typeof entry.createdAt === "string" ? entry.createdAt : fallbackTimestamp,
        updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : fallbackTimestamp
      }))
    : [];

  const tastingPlaces = Array.isArray(store.tastingPlaces)
    ? store.tastingPlaces.map((entry): TastingPlace => ({
        id: String(entry.id),
        name: String(entry.name ?? "Unnamed place"),
        notes: typeof entry.notes === "string" ? entry.notes : undefined,
        createdAt: typeof entry.createdAt === "string" ? entry.createdAt : fallbackTimestamp,
        updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : fallbackTimestamp
      }))
    : [];

  const tastingSessions = Array.isArray(store.tastingSessions)
    ? store.tastingSessions.map((entry): TastingSession => ({
        id: String(entry.id),
        title: typeof entry.title === "string" ? entry.title : undefined,
        occasionType:
          entry.occasionType === "visit" ||
          entry.occasionType === "whisky_friday"
            ? entry.occasionType
            : "other",
        sessionDate: typeof entry.sessionDate === "string" ? entry.sessionDate : fallbackTimestamp,
        placeId: typeof entry.placeId === "string" ? entry.placeId : undefined,
        groupId: typeof entry.groupId === "string" ? entry.groupId : undefined,
        notes: typeof entry.notes === "string" ? entry.notes : undefined,
        createdAt: typeof entry.createdAt === "string" ? entry.createdAt : fallbackTimestamp,
        updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : fallbackTimestamp
      }))
    : [];

  const tastingSessionAttendees = Array.isArray(store.tastingSessionAttendees)
    ? store.tastingSessionAttendees.map((entry): TastingSessionAttendee => ({
        id: String(entry.id),
        sessionId: String(entry.sessionId),
        personId: String(entry.personId)
      }))
    : [];

  const tastingSessionBottles = Array.isArray(store.tastingSessionBottles)
    ? store.tastingSessionBottles.map((entry): TastingSessionBottle => ({
        id: String(entry.id),
        sessionId: String(entry.sessionId),
        collectionItemId: String(entry.collectionItemId)
      }))
    : [];

  return {
    ...store,
    tastingEntries: Array.isArray(store.tastingEntries) ? store.tastingEntries : [],
    tastingPeople,
    tastingGroups,
    tastingPlaces,
    tastingSessions,
    tastingSessionAttendees,
    tastingSessionBottles
  };
}

function legacyExpressionToFlat(
  expression: Record<string, unknown>,
  distilleryName?: string,
  bottlerName?: string
): Expression {
  const tags = toLegacyTags(expression, expression.flavorTags);

  return {
    id: String(expression.id),
    name: String(expression.name ?? "Unknown whisky"),
    distilleryName: distilleryName ?? (typeof expression.distilleryName === "string" ? expression.distilleryName : undefined),
    bottlerName: bottlerName ?? (typeof expression.bottlerName === "string" ? expression.bottlerName : undefined),
    brand: typeof expression.brand === "string" ? expression.brand : undefined,
    country: typeof expression.country === "string" ? expression.country : undefined,
    abv: typeof expression.abv === "number" ? expression.abv : Number(expression.abv ?? undefined) || undefined,
    ageStatement:
      typeof expression.ageStatement === "number"
        ? expression.ageStatement
        : Number(expression.ageStatement ?? undefined) || undefined,
    barcode: typeof expression.barcode === "string" ? expression.barcode : undefined,
    description: typeof expression.description === "string" ? expression.description : undefined,
    imageUrl: typeof expression.imageUrl === "string" ? expression.imageUrl : undefined,
    tags
  };
}

function legacyDraftToFlat(
  draft: Record<string, unknown>,
  distilleryNames: Map<string, string>,
  bottlerNames: Map<string, string>
): IntakeDraft {
  const legacyExpression = (draft.expression ?? {}) as Record<string, unknown>;
  const legacyAiResponse =
    draft["rawAiResponse"] && typeof draft["rawAiResponse"] === "object"
      ? (draft["rawAiResponse"] as Record<string, unknown>)
      : {};
  const legacyCollection =
    draft["collection"] && typeof draft["collection"] === "object" ? (draft["collection"] as Record<string, unknown>) : {};
  const distilleryName =
    typeof draft.distilleryName === "string"
      ? draft.distilleryName
      : typeof legacyExpression.distilleryName === "string"
        ? legacyExpression.distilleryName
        : typeof legacyExpression.distilleryId === "string"
          ? distilleryNames.get(legacyExpression.distilleryId) ?? undefined
          : undefined;
  const bottlerName =
    typeof draft.bottlerName === "string"
      ? draft.bottlerName
      : typeof legacyExpression.bottlerName === "string"
        ? legacyExpression.bottlerName
        : typeof legacyExpression.bottlerId === "string"
          ? bottlerNames.get(legacyExpression.bottlerId) ?? undefined
          : undefined;

  return {
    id: String(draft.id),
    collectionItemId: String(draft.collectionItemId ?? draft.collection_item_id ?? `item_${draft.id}`),
    source: (draft.source as IntakeDraft["source"]) ?? "photo",
    barcode: typeof draft.barcode === "string" ? draft.barcode : undefined,
    rawAiResponse: {
      identificationText:
        typeof legacyAiResponse["identificationText"] === "string"
          ? legacyAiResponse["identificationText"]
          : typeof draft["identification"] === "string"
            ? String(draft["identification"])
            : draft["identification"] && typeof draft["identification"] === "object"
              ? JSON.stringify(draft["identification"])
              : undefined,
      enrichmentText:
        typeof legacyAiResponse["enrichmentText"] === "string"
          ? legacyAiResponse["enrichmentText"]
          : draft["raw_expression"]
            ? JSON.stringify(draft["raw_expression"])
            : undefined
    },
    expression: {
      name: String(legacyExpression.name ?? "Unknown whisky"),
      distilleryName,
      bottlerName,
      brand: typeof legacyExpression.brand === "string" ? legacyExpression.brand : undefined,
      country: typeof legacyExpression.country === "string" ? legacyExpression.country : undefined,
      abv: typeof legacyExpression.abv === "number" ? legacyExpression.abv : Number(legacyExpression.abv ?? undefined) || undefined,
      ageStatement:
        typeof legacyExpression.ageStatement === "number"
          ? legacyExpression.ageStatement
          : Number(legacyExpression.ageStatement ?? undefined) || undefined,
      barcode: typeof legacyExpression.barcode === "string" ? legacyExpression.barcode : undefined,
      description: typeof legacyExpression.description === "string" ? legacyExpression.description : undefined,
      tags: toLegacyTags(legacyExpression, legacyExpression.flavorTags)
    },
    collection: {
      status: legacyCollection["status"] === "wishlist" ? "wishlist" : "owned",
      fillState:
        legacyCollection["fillState"] === "open" || legacyCollection["fillState"] === "finished"
          ? (legacyCollection["fillState"] as CollectionItem["fillState"])
          : "sealed",
      purchaseCurrency: typeof legacyCollection["purchaseCurrency"] === "string" ? String(legacyCollection["purchaseCurrency"]) : "ZAR"
    }
  };
}

function isLegacyStore(store: Record<string, unknown>) {
  return (
    Array.isArray(store.distilleries) ||
    Array.isArray(store.bottlers) ||
    Array.isArray(store.citations) ||
    Array.isArray(store.priceSnapshots) ||
    (Array.isArray(store.expressions) &&
      store.expressions.some((entry) => entry && typeof entry === "object" && "distilleryId" in entry))
  );
}

function migrateLegacyStore(store: Record<string, unknown>): WhiskyStore {
  const distilleries = Array.isArray(store.distilleries) ? store.distilleries : [];
  const bottlers = Array.isArray(store.bottlers) ? store.bottlers : [];
  const distilleryNames = new Map<string, string>();
  const bottlerNames = new Map<string, string>();

  for (const entry of distilleries) {
    if (entry && typeof entry === "object" && typeof entry.id === "string" && typeof entry.name === "string") {
      distilleryNames.set(entry.id, entry.name);
    }
  }

  for (const entry of bottlers) {
    if (entry && typeof entry === "object" && typeof entry.id === "string" && typeof entry.name === "string") {
      bottlerNames.set(entry.id, entry.name);
    }
  }

  const expressions = Array.isArray(store.expressions)
    ? store.expressions.map((entry) => {
        const legacyExpression = (entry ?? {}) as Record<string, unknown>;
        const distilleryName =
          typeof legacyExpression.distilleryName === "string"
            ? legacyExpression.distilleryName
            : typeof legacyExpression.distilleryId === "string"
              ? distilleryNames.get(legacyExpression.distilleryId)
              : undefined;
        const bottlerName =
          typeof legacyExpression.bottlerName === "string"
            ? legacyExpression.bottlerName
            : typeof legacyExpression.bottlerId === "string"
              ? bottlerNames.get(legacyExpression.bottlerId)
              : undefined;

        return legacyExpressionToFlat(legacyExpression, distilleryName, bottlerName);
      })
    : [];

  const collectionItems = Array.isArray(store.collectionItems)
    ? store.collectionItems.map((entry): CollectionItem => ({
        id: String(entry.id),
        expressionId: String(entry.expressionId ?? entry.expression_id),
        status: entry.status === "wishlist" ? "wishlist" : "owned",
        fillState:
          entry.fillState === "open" || entry.fill_state === "open"
            ? "open"
            : entry.fillState === "finished" || entry.fill_state === "finished"
              ? "finished"
              : "sealed",
        purchasePrice: toNumber(entry.purchasePrice ?? entry.purchase_price),
        purchaseCurrency:
          typeof entry.purchaseCurrency === "string"
            ? entry.purchaseCurrency
            : typeof entry.purchase_currency === "string"
              ? entry.purchase_currency
              : "ZAR",
        purchaseDate:
          typeof entry.purchaseDate === "string"
            ? entry.purchaseDate
            : typeof entry.purchase_date === "string"
              ? entry.purchase_date
              : undefined,
        purchaseSource:
          typeof entry.purchaseSource === "string"
            ? entry.purchaseSource
            : typeof entry.purchase_source === "string"
              ? entry.purchase_source
              : undefined,
        personalNotes:
          typeof entry.personalNotes === "string"
            ? entry.personalNotes
            : typeof entry.personal_notes === "string"
              ? entry.personal_notes
              : undefined,
        rating: toRating(entry.rating ?? entry.is_favorite),
        isFavorite: entry.isFavorite === true || entry.is_favorite === true,
        createdAt: typeof entry.createdAt === "string" ? entry.createdAt : fallbackTimestamp,
        updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : fallbackTimestamp
      }))
    : [];

  const itemImages = Array.isArray(store.itemImages)
    ? store.itemImages.map((entry) => ({
        id: String(entry.id),
        collectionItemId: String(entry.collectionItemId ?? entry.collection_item_id),
        kind: entry.kind === "back" || entry.kind === "detail" ? entry.kind : "front",
        url: String(entry.url ?? ""),
        label: typeof entry.label === "string" ? entry.label : undefined
      }))
    : [];

  const drafts = Array.isArray(store.drafts)
    ? store.drafts.map((draft) => legacyDraftToFlat((draft ?? {}) as Record<string, unknown>, distilleryNames, bottlerNames))
    : [];

  return {
    expressions,
    collectionItems,
    itemImages,
    tastingEntries: Array.isArray(store.tastingEntries) ? store.tastingEntries : [],
    tastingPeople: [],
    tastingGroups: [],
    tastingPlaces: [],
    tastingSessions: [],
    tastingSessionAttendees: [],
    tastingSessionBottles: [],
    drafts
  };
}

async function ensureStoreFile() {
  await mkdir(dataDir, { recursive: true });

  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    if (isLegacyStore(parsed)) {
      const migrated = normalizeStore(migrateLegacyStore(parsed));
      await writeFile(storePath, JSON.stringify(migrated, null, 2), "utf8");
    }
  } catch {
    await writeStore(seedStore);
  }
}

export async function readStore() {
  if (isSupabaseStoreEnabled()) {
    return readStoreFromSupabase();
  }

  await ensureStoreFile();
  const contents = await readFile(storePath, "utf8");
  const parsed = JSON.parse(contents) as Record<string, unknown>;

  if (isLegacyStore(parsed)) {
    const migrated = normalizeStore(migrateLegacyStore(parsed));
    await writeFile(storePath, JSON.stringify(migrated, null, 2), "utf8");
    return migrated;
  }

  return normalizeStore(parsed as unknown as WhiskyStore);
}

export async function writeStore(store: WhiskyStore) {
  if (isSupabaseStoreEnabled()) {
    await writeStoreToSupabase(store);
    return;
  }

  await mkdir(dataDir, { recursive: true });
  await writeFile(storePath, JSON.stringify(normalizeStore(store), null, 2), "utf8");
}
