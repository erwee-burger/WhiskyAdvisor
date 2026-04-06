import Papa from "papaparse";

import { buildBuyNextSuggestions, buildDrinkNowSuggestions } from "@/lib/advisor";
import { buildCollectionAnalytics } from "@/lib/analytics";
import { buildComparison } from "@/lib/comparison";
import { convertToZar } from "@/lib/currency";
import { createId } from "@/lib/id";
import { readStore, writeStore } from "@/lib/mock-store";
import {
  analyzeBottleImage,
  buildDraftFromMatchedExpression,
  refreshPricingWithAi
} from "@/lib/openai";
import { buildPalateProfile } from "@/lib/profile";
import type {
  Bottler,
  BottlerKind,
  CollectionItem,
  CollectionStatus,
  CollectionViewItem,
  Distillery,
  Expression,
  FillState,
  ItemImage,
  IntakeRawExpression,
  IntakeReviewItem,
  PriceSnapshot,
  TastingEntry,
  WhiskyStore
} from "@/lib/types";

type DraftView = {
  draftId: string;
  matchedExpressionId?: string;
  source: string;
  barcode?: string;
  rawExpression?: IntakeRawExpression;
  identification?: {
    identifiedName: string | null;
    brand: string | null;
    distilleryName: string | null;
    bottlerName: string | null;
    bottlerKind: string | null;
    country: string | null;
    ageStatement: number | null;
    releaseSeries: string | null;
    caskType: string | null;
    whiskyType: string | null;
    productMatchConfidence: number | null;
    internetLookupUsed: boolean | null;
    matchNotes: string | null;
  };
  distilleryName?: string;
  bottlerName?: string;
  collection: {
    status: CollectionStatus;
    fillState: FillState;
    purchaseCurrency: string;
  };
  expression: {
    brand?: string;
    name: string;
    releaseSeries?: string;
    bottlerKind?: Expression["bottlerKind"];
    whiskyType?: Expression["whiskyType"];
    country?: string;
    region?: string;
    abv?: number;
    ageStatement?: number;
    vintageYear?: number;
    distilledYear?: number;
    bottledYear?: number;
    volumeMl?: number;
    caskType?: string;
    caskNumber?: string;
    bottleNumber?: number;
    outturn?: number;
    barcode?: string;
    peatLevel?: Expression["peatLevel"];
    caskInfluence?: Expression["caskInfluence"];
    isNas?: boolean;
    isChillFiltered?: boolean;
    isNaturalColor?: boolean;
    isLimited?: boolean;
    flavorTags?: string[];
    description?: string;
  };
  suggestions: Array<{
    field: string;
    label: string;
    confidence: number;
  }>;
  reviewItems: IntakeReviewItem[];
};

type BottleRecordPayload = {
  distilleryName?: string;
  bottlerName?: string;
  brand?: string;
  name: string;
  releaseSeries?: string;
  bottlerKind?: Expression["bottlerKind"];
  whiskyType?: Expression["whiskyType"];
  country: string;
  region?: string;
  abv?: number;
  ageStatement?: number;
  vintageYear?: number;
  distilledYear?: number;
  bottledYear?: number;
  volumeMl?: number;
  caskType?: string;
  caskNumber?: string;
  bottleNumber?: number;
  outturn?: number;
  barcode?: string;
  peatLevel?: Expression["peatLevel"];
  caskInfluence?: Expression["caskInfluence"];
  isNas: boolean;
  isChillFiltered: boolean;
  isNaturalColor: boolean;
  isLimited: boolean;
  flavorTags: string[];
  description?: string;
  status: CollectionStatus;
  fillState: FillState;
  purchaseCurrency: string;
  purchasePrice?: number;
  purchaseDate?: string;
  purchaseSource?: string;
  personalNotes?: string;
  frontImageUrl?: string;
  frontImageLabel?: string;
};

function toCollectionViewItems(store: WhiskyStore): CollectionViewItem[] {
  return store.collectionItems.map((item) => {
    const expression = store.expressions.find((entry) => entry.id === item.expressionId);
    if (!expression) {
      throw new Error(`Missing expression for item ${item.id}`);
    }

    const distillery = store.distilleries.find((entry) => entry.id === expression.distilleryId);
    const bottler = store.bottlers.find((entry) => entry.id === expression.bottlerId);

    if (!distillery || !bottler) {
      throw new Error(`Missing relationship for expression ${expression.id}`);
    }

    const tastingEntries = store.tastingEntries
      .filter((entry) => entry.collectionItemId === item.id)
      .sort((left, right) => right.tastedAt.localeCompare(left.tastedAt));

    return {
      item,
      expression,
      distillery,
      bottler,
      tastingEntries,
      latestTasting: tastingEntries[0],
      priceSnapshot: store.priceSnapshots.find((entry) => entry.expressionId === expression.id),
      images: store.itemImages.filter((entry) => entry.collectionItemId === item.id)
    };
  });
}

function toExpressionView(store: WhiskyStore, expressionId: string): CollectionViewItem | null {
  const expression = store.expressions.find((entry) => entry.id === expressionId);

  if (!expression) {
    return null;
  }

  const distillery = store.distilleries.find((entry) => entry.id === expression.distilleryId);
  const bottler = store.bottlers.find((entry) => entry.id === expression.bottlerId);

  if (!distillery || !bottler) {
    return null;
  }

  const existingItem = store.collectionItems.find((entry) => entry.expressionId === expressionId);
  const tastingEntries = existingItem
    ? store.tastingEntries
        .filter((entry) => entry.collectionItemId === existingItem.id)
        .sort((left, right) => right.tastedAt.localeCompare(left.tastedAt))
    : [];

  return {
    item:
      existingItem ?? {
        id: `virtual_${expression.id}`,
        expressionId: expression.id,
        status: "wishlist",
        fillState: "sealed",
        purchaseCurrency: "ZAR",
        draft: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
    expression,
    distillery,
    bottler,
    tastingEntries,
    latestTasting: tastingEntries[0],
    priceSnapshot: store.priceSnapshots.find((entry) => entry.expressionId === expression.id),
    images: existingItem
      ? store.itemImages.filter((entry) => entry.collectionItemId === existingItem.id)
      : []
  };
}

function buildFallbackExpression(name: string, barcode?: string): Expression {
  return {
    id: createId("expr"),
    name,
    brand: undefined,
    distilleryId: createId("dist"),
    bottlerId: createId("bot"),
    bottlerKind: "official",
    whiskyType: "single-malt",
    country: "Unknown",
    region: "Unknown",
    abv: 46,
    ageStatement: undefined,
    isNas: true,
    vintageYear: undefined,
    distilledYear: undefined,
    bottledYear: undefined,
    volumeMl: undefined,
    caskType: undefined,
    caskNumber: undefined,
    bottleNumber: undefined,
    outturn: undefined,
    peatLevel: "medium",
    caskInfluence: "mixed",
    isChillFiltered: false,
    isNaturalColor: false,
    isLimited: false,
    flavorTags: ["malt"],
    barcode,
    description: undefined
  };
}

function normalizeText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeNumber(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return undefined;
  }

  return value;
}

function normalizeBoolean(value?: boolean | null) {
  if (value === undefined || value === null) {
    return undefined;
  }

  return value;
}

function normalizeFlavorTags(value?: string[]) {
  return (value ?? []).map((tag) => tag.trim()).filter(Boolean);
}

function ensureDistillery(
  store: WhiskyStore,
  name?: string,
  country?: string,
  region?: string
) {
  const distilleryName = normalizeText(name) ?? "Unknown Distillery";
  const distilleryCountry = normalizeText(country) ?? "Unknown";
  const distilleryRegion = normalizeText(region) ?? "Unknown";
  const existingIndex = store.distilleries.findIndex(
    (entry) => entry.name.toLowerCase() === distilleryName.toLowerCase()
  );

  if (existingIndex >= 0) {
    const existing = store.distilleries[existingIndex];
    const updated: Distillery = {
      ...existing,
      country: distilleryCountry,
      region: distilleryRegion
    };
    store.distilleries[existingIndex] = updated;
    return updated;
  }

  const created: Distillery = {
    id: createId("dist"),
    name: distilleryName,
    country: distilleryCountry,
    region: distilleryRegion
  };
  store.distilleries.unshift(created);
  return created;
}

function ensureBottler(
  store: WhiskyStore,
  name: string | undefined,
  bottlerKind: Expression["bottlerKind"] | undefined,
  country?: string
) {
  const resolvedBottlerKind: BottlerKind = bottlerKind ?? "official";
  const bottlerName = normalizeText(name) ?? "Unknown Bottler";
  const bottlerCountry = normalizeText(country);
  const existingIndex = store.bottlers.findIndex(
    (entry) => entry.name.toLowerCase() === bottlerName.toLowerCase()
  );

  if (existingIndex >= 0) {
    const existing = store.bottlers[existingIndex];
    const updated: Bottler = {
      ...existing,
      bottlerKind: resolvedBottlerKind,
      country: bottlerCountry ?? existing.country
    };
    store.bottlers[existingIndex] = updated;
    return updated;
  }

  const created: Bottler = {
    id: createId("bot"),
    name: bottlerName,
    bottlerKind: resolvedBottlerKind,
    country: bottlerCountry
  };
  store.bottlers.unshift(created);
  return created;
}

function buildDraftView(store: WhiskyStore, draft: Awaited<ReturnType<typeof getDraftById>>) {
  if (!draft) {
    return null;
  }

  const baseExpression = draft.matchedExpressionId
    ? store.expressions.find((entry) => entry.id === draft.matchedExpressionId)
    : undefined;
  const distillery = baseExpression
    ? store.distilleries.find((entry) => entry.id === baseExpression.distilleryId)
    : undefined;
  const bottler = baseExpression
    ? store.bottlers.find((entry) => entry.id === baseExpression.bottlerId)
    : undefined;
  const extractedDistilleryName = normalizeText(draft.rawExpression?.distilleryName);
  const extractedBottlerName = normalizeText(draft.rawExpression?.bottlerName);

  return {
    draftId: draft.id,
    matchedExpressionId: draft.matchedExpressionId,
    source: draft.source,
    barcode: draft.barcode,
    identification:
      draft.identification ??
      (draft.rawExpression?.name
        ? {
            identifiedName: draft.rawExpression.name,
            brand: draft.rawExpression.brand ?? null,
            distilleryName: draft.rawExpression.distilleryName ?? null,
            bottlerName: draft.rawExpression.bottlerName ?? null,
            bottlerKind: draft.rawExpression.bottlerKind ?? null,
            country: draft.rawExpression.country ?? null,
            ageStatement: draft.rawExpression.ageStatement ?? null,
            releaseSeries: draft.rawExpression.releaseSeries ?? null,
            caskType: draft.rawExpression.caskType ?? null,
            whiskyType: draft.rawExpression.whiskyType ?? null,
            productMatchConfidence: null,
            internetLookupUsed: null,
            matchNotes: null
          }
        : undefined),
    rawExpression: draft.rawExpression,
    distilleryName:
      extractedDistilleryName ??
      draft.identification?.distilleryName ??
      distillery?.name ??
      undefined,
    bottlerName:
      extractedBottlerName ??
      draft.identification?.bottlerName ??
      bottler?.name ??
      undefined,
    collection: {
      status: draft.collection.status ?? "owned",
      fillState: draft.collection.fillState ?? "sealed",
      purchaseCurrency: draft.collection.purchaseCurrency ?? "ZAR"
    },
    expression: {
      brand: normalizeText(draft.expression.brand),
      name: draft.expression.name,
      releaseSeries: normalizeText(draft.expression.releaseSeries),
      bottlerKind: draft.expression.bottlerKind,
      whiskyType: draft.expression.whiskyType,
      country: normalizeText(draft.expression.country),
      region: normalizeText(draft.expression.region),
      abv: normalizeNumber(draft.expression.abv),
      ageStatement: normalizeNumber(draft.expression.ageStatement),
      vintageYear: normalizeNumber(draft.expression.vintageYear),
      distilledYear: normalizeNumber(draft.expression.distilledYear),
      bottledYear: normalizeNumber(draft.expression.bottledYear),
      volumeMl: normalizeNumber(draft.expression.volumeMl),
      caskType: normalizeText(draft.expression.caskType),
      caskNumber: normalizeText(draft.expression.caskNumber),
      bottleNumber: normalizeNumber(draft.expression.bottleNumber),
      outturn: normalizeNumber(draft.expression.outturn),
      barcode: normalizeText(draft.expression.barcode) ?? draft.barcode,
      peatLevel: draft.expression.peatLevel,
      caskInfluence: draft.expression.caskInfluence,
      isNas: draft.expression.isNas,
      isChillFiltered: normalizeBoolean(draft.expression.isChillFiltered),
      isNaturalColor: normalizeBoolean(draft.expression.isNaturalColor),
      isLimited: normalizeBoolean(draft.expression.isLimited),
      flavorTags: normalizeFlavorTags(draft.expression.flavorTags),
      description: normalizeText(draft.expression.description)
    },
    suggestions: draft.suggestions.map((suggestion) => ({
      field: suggestion.field,
      label: suggestion.label,
      confidence: suggestion.confidence
    })),
    reviewItems: draft.reviewItems ?? []
  } satisfies DraftView;
}

function upsertItemImage(store: WhiskyStore, image: ItemImage) {
  const existingIndex = store.itemImages.findIndex(
    (entry) => entry.collectionItemId === image.collectionItemId && entry.kind === image.kind
  );

  if (existingIndex >= 0) {
    store.itemImages[existingIndex] = {
      ...image,
      id: store.itemImages[existingIndex].id
    };
    return;
  }

  store.itemImages.unshift(image);
}

function buildExpressionRecord(
  expressionId: string,
  baseExpression: Expression | null | undefined,
  payload: BottleRecordPayload,
  distilleryId: string,
  bottlerId: string
): Expression {
  return {
    id: expressionId,
    brand: normalizeText(payload.brand) ?? baseExpression?.brand,
    name: payload.name,
    distilleryId,
    bottlerId,
    bottlerKind: payload.bottlerKind ?? baseExpression?.bottlerKind ?? "official",
    whiskyType: payload.whiskyType ?? baseExpression?.whiskyType ?? "single-malt",
    releaseSeries: normalizeText(payload.releaseSeries),
    country: normalizeText(payload.country) ?? "Unknown",
    region: normalizeText(payload.region) ?? baseExpression?.region ?? "Unknown",
    abv: normalizeNumber(payload.abv) ?? baseExpression?.abv ?? 46,
    ageStatement: normalizeNumber(payload.ageStatement),
    vintageYear: normalizeNumber(payload.vintageYear),
    distilledYear: normalizeNumber(payload.distilledYear),
    bottledYear: normalizeNumber(payload.bottledYear),
    volumeMl: normalizeNumber(payload.volumeMl),
    caskType: normalizeText(payload.caskType),
    caskNumber: normalizeText(payload.caskNumber),
    bottleNumber: normalizeNumber(payload.bottleNumber),
    outturn: normalizeNumber(payload.outturn),
    barcode: normalizeText(payload.barcode),
    peatLevel: payload.peatLevel ?? baseExpression?.peatLevel ?? "unpeated",
    caskInfluence: payload.caskInfluence ?? baseExpression?.caskInfluence ?? "refill",
    isNas: payload.isNas || normalizeNumber(payload.ageStatement) === undefined,
    isChillFiltered: payload.isChillFiltered,
    isNaturalColor: payload.isNaturalColor,
    isLimited: payload.isLimited,
    flavorTags: normalizeFlavorTags(payload.flavorTags),
    description: normalizeText(payload.description),
    imageUrl: baseExpression?.imageUrl
  };
}

function buildCollectionItemRecord(
  itemId: string,
  expressionId: string,
  payload: BottleRecordPayload,
  existingItem?: CollectionItem | null
): CollectionItem {
  const now = new Date().toISOString();

  return {
    id: itemId,
    expressionId,
    status: payload.status,
    fillState: payload.fillState,
    purchaseCurrency: payload.purchaseCurrency,
    purchasePrice: payload.purchasePrice,
    purchaseDate: payload.purchaseDate,
    purchaseSource: payload.purchaseSource,
    personalNotes: payload.personalNotes,
    createdAt: existingItem?.createdAt ?? now,
    updatedAt: now,
    openedDate: existingItem?.openedDate,
    finishedDate: existingItem?.finishedDate
  };
}

function pruneUnusedDistillery(store: WhiskyStore, distilleryId?: string) {
  if (!distilleryId) {
    return;
  }

  const stillUsed = store.expressions.some((entry) => entry.distilleryId === distilleryId);
  if (!stillUsed) {
    store.distilleries = store.distilleries.filter((entry) => entry.id !== distilleryId);
  }
}

function pruneUnusedBottler(store: WhiskyStore, bottlerId?: string) {
  if (!bottlerId) {
    return;
  }

  const stillUsed = store.expressions.some((entry) => entry.bottlerId === bottlerId);
  if (!stillUsed) {
    store.bottlers = store.bottlers.filter((entry) => entry.id !== bottlerId);
  }
}

function removeExpressionIfOrphaned(store: WhiskyStore, expressionId: string) {
  const stillReferenced = store.collectionItems.some((entry) => entry.expressionId === expressionId);

  if (stillReferenced) {
    return;
  }

  const expression = store.expressions.find((entry) => entry.id === expressionId);

  store.priceSnapshots = store.priceSnapshots.filter((entry) => entry.expressionId !== expressionId);
  store.citations = store.citations.filter((entry) => entry.entityId !== expressionId);
  store.expressions = store.expressions.filter((entry) => entry.id !== expressionId);

  if (expression) {
    pruneUnusedDistillery(store, expression.distilleryId);
    pruneUnusedBottler(store, expression.bottlerId);
  }
}

export async function getCollectionView() {
  const store = await readStore();
  return toCollectionViewItems(store);
}

export async function getDashboardData() {
  const collection = await getCollectionView();
  const profile = buildPalateProfile(collection.filter((entry) => entry.item.status === "owned"));

  return {
    collection,
    analytics: buildCollectionAnalytics(collection),
    profile,
    drinkNow: buildDrinkNowSuggestions(collection, profile),
    buyNext: buildBuyNextSuggestions(collection, profile)
  };
}

export async function getItemById(itemId: string) {
  const collection = await getCollectionView();
  return collection.find(({ item }) => item.id === itemId) ?? null;
}

export async function getDraftViewById(draftId: string) {
  const store = await readStore();
  const draft = store.drafts.find((entry) => entry.id === draftId);
  return buildDraftView(store, draft ?? null);
}

export async function getExpressionChoiceList() {
  const store = await readStore();

  return store.expressions.map((expression) => {
    const distillery = store.distilleries.find((entry) => entry.id === expression.distilleryId);
    const bottler = store.bottlers.find((entry) => entry.id === expression.bottlerId);
    const existingItem = store.collectionItems.find((entry) => entry.expressionId === expression.id);

    return {
      itemId: existingItem?.id ?? expression.id,
      expressionId: expression.id,
      label: `${expression.name} - ${distillery?.name ?? "Unknown distillery"}`,
      subtitle: `${bottler?.name ?? "Unknown bottler"} - ${expression.region}`
    };
  });
}

export async function createDraftFromBarcode(barcode: string) {
  const store = await readStore();
  const matched =
    store.expressions.find((entry) => entry.barcode === barcode) ??
    store.expressions.find((entry) => barcode && entry.name.toLowerCase().includes(barcode.toLowerCase()));

  const expression = matched ?? buildFallbackExpression(`Unknown whisky (${barcode})`, barcode);
  const draft = buildDraftFromMatchedExpression(expression, "barcode", barcode);
  if (!matched) {
    draft.matchedExpressionId = undefined;
    draft.expression = { ...draft.expression, name: `Unknown whisky (${barcode})` };
  }
  store.drafts.unshift(draft);
  await writeStore(store);
  return draft;
}

export async function createDraftFromPhoto(
  fileName: string,
  imageBase64?: string,
  mimeType = "image/jpeg"
) {
  const store = await readStore();
  const aiResult = await analyzeBottleImage(fileName, imageBase64, mimeType);
  const evidenceUrl = fileName ? `upload://front-label/${encodeURIComponent(fileName)}` : undefined;
  const matched =
    store.expressions.find(
      (entry) => entry.name.toLowerCase() === aiResult?.expression.name?.toLowerCase()
    ) ??
    store.expressions.find((entry) =>
      fileName.toLowerCase().includes(entry.name.toLowerCase().split(" ")[0])
    );

  const expression =
    matched ??
    buildFallbackExpression(
      aiResult?.expression.name ?? fileName.replace(/\.[^.]+$/, ""),
      undefined
    );
  const draft = buildDraftFromMatchedExpression(expression, aiResult ? "hybrid" : "photo", undefined, {
    url: evidenceUrl,
    label: fileName
  });
  if (!matched) {
    draft.matchedExpressionId = undefined;
  }

  if (aiResult?.expression) {
    draft.expression = {
      brand: aiResult.expression.brand,
      name: aiResult.expression.name ?? draft.expression.name,
      releaseSeries: aiResult.expression.releaseSeries,
      bottlerKind: aiResult.expression.bottlerKind,
      whiskyType: aiResult.expression.whiskyType,
      country: aiResult.expression.country,
      region: aiResult.expression.region,
      abv: aiResult.expression.abv,
      ageStatement: aiResult.expression.ageStatement,
      vintageYear: aiResult.expression.vintageYear,
      distilledYear: aiResult.expression.distilledYear,
      bottledYear: aiResult.expression.bottledYear,
      volumeMl: aiResult.expression.volumeMl,
      caskType: aiResult.expression.caskType,
      caskNumber: aiResult.expression.caskNumber,
      bottleNumber: aiResult.expression.bottleNumber,
      outturn: aiResult.expression.outturn,
      barcode: aiResult.expression.barcode,
      peatLevel: aiResult.expression.peatLevel,
      caskInfluence: aiResult.expression.caskInfluence,
      isNas: aiResult.expression.isNas,
      isChillFiltered: aiResult.expression.isChillFiltered,
      isNaturalColor: aiResult.expression.isNaturalColor,
      isLimited: aiResult.expression.isLimited,
      flavorTags: aiResult.expression.flavorTags,
      description: aiResult.expression.description
    };
  }

  if (aiResult?.rawExpression) {
    draft.rawExpression = aiResult.rawExpression;
  }

  if (aiResult?.reviewItems) {
    draft.reviewItems = aiResult.reviewItems;
  }

  if (aiResult?.identification) {
    draft.identification = aiResult.identification;
  }

  store.drafts.unshift(draft);
  await writeStore(store);
  return draft;
}

function upsertPriceSnapshot(store: WhiskyStore, snapshot: PriceSnapshot) {
  const index = store.priceSnapshots.findIndex(
    (entry) => entry.expressionId === snapshot.expressionId
  );

  if (index >= 0) {
    store.priceSnapshots[index] = snapshot;
  } else {
    store.priceSnapshots.unshift(snapshot);
  }
}

export async function refreshPricing(itemId: string) {
  const store = await readStore();
  const item = store.collectionItems.find((entry) => entry.id === itemId);

  if (!item) {
    return null;
  }

  const expression = store.expressions.find((entry) => entry.id === item.expressionId);

  if (!expression) {
    return null;
  }

  const aiSnapshot = await refreshPricingWithAi(expression);

  if (aiSnapshot) {
    upsertPriceSnapshot(store, aiSnapshot);
    await writeStore(store);
    return aiSnapshot;
  }

  const existing = store.priceSnapshots.find((entry) => entry.expressionId === expression.id);
  if (existing) {
    return existing;
  }

  const generated: PriceSnapshot = {
    id: createId("price"),
    expressionId: expression.id,
    refreshedAt: new Date().toISOString(),
    retail: {
      sourceKind: "retail",
      currency: item.purchaseCurrency || "ZAR",
      low: Math.round((item.purchasePrice ?? 1600) * 1.05),
      high: Math.round((item.purchasePrice ?? 1600) * 1.25),
      lowZar: convertToZar(
        Math.round((item.purchasePrice ?? 1600) * 1.05),
        item.purchaseCurrency || "ZAR"
      ),
      highZar: convertToZar(
        Math.round((item.purchasePrice ?? 1600) * 1.25),
        item.purchaseCurrency || "ZAR"
      ),
      confidence: 0.58,
      refreshedAt: new Date().toISOString(),
      sources: [
        {
          label: "Mock pricing fallback",
          url: "https://example.com/mock-pricing",
          currency: item.purchaseCurrency || "ZAR",
          amount: Math.round((item.purchasePrice ?? 1600) * 1.15),
          normalizedZar: convertToZar(
            Math.round((item.purchasePrice ?? 1600) * 1.15),
            item.purchaseCurrency || "ZAR"
          ),
          confidence: 0.58
        }
      ]
    }
  };

  upsertPriceSnapshot(store, generated);
  await writeStore(store);
  return generated;
}

export async function saveDraftAsItem(
  draftId: string,
  payload: BottleRecordPayload
) {
  const store = await readStore();
  const draftIndex = store.drafts.findIndex((entry) => entry.id === draftId);
  if (draftIndex < 0) {
    return null;
  }

  const draft = store.drafts[draftIndex];
  const baseExpression = draft.matchedExpressionId
    ? store.expressions.find((entry) => entry.id === draft.matchedExpressionId)
    : null;
  const expressionId = baseExpression?.id ?? createId("expr");
  const distillery = ensureDistillery(store, payload.distilleryName, payload.country, payload.region);
  const bottler = ensureBottler(
    store,
    payload.bottlerName,
    payload.bottlerKind,
    payload.country
  );
  const expressionRecord = buildExpressionRecord(
    expressionId,
    baseExpression,
    payload,
    distillery.id,
    bottler.id
  );
  const expressionIndex = store.expressions.findIndex((entry) => entry.id === expressionId);

  if (expressionIndex >= 0) {
    store.expressions[expressionIndex] = expressionRecord;
  } else {
    store.expressions.unshift(expressionRecord);
  }

  const item = buildCollectionItemRecord(draft.collectionItemId, expressionId, payload);

  const existingItemIndex = store.collectionItems.findIndex((entry) => entry.id === item.id);

  if (existingItemIndex >= 0) {
    store.collectionItems[existingItemIndex] = item;
  } else {
    store.collectionItems.unshift(item);
  }

  if (payload.frontImageUrl) {
    upsertItemImage(store, {
      id: createId("img"),
      collectionItemId: item.id,
      kind: "front",
      url: payload.frontImageUrl,
      label: normalizeText(payload.frontImageLabel) ?? "Uploaded front label"
    });
  }

  store.citations.unshift(
    ...draft.citations.map((citation) =>
      citation.entityType === "expression"
        ? {
            ...citation,
            entityId: expressionId
          }
        : citation
    )
  );
  store.drafts.splice(draftIndex, 1);
  await writeStore(store);
  return item;
}

export async function updateItem(itemId: string, payload: BottleRecordPayload) {
  const store = await readStore();
  const itemIndex = store.collectionItems.findIndex((entry) => entry.id === itemId);

  if (itemIndex < 0) {
    return null;
  }

  const existingItem = store.collectionItems[itemIndex];
  const expressionIndex = store.expressions.findIndex(
    (entry) => entry.id === existingItem.expressionId
  );

  if (expressionIndex < 0) {
    return null;
  }

  const previousExpression = store.expressions[expressionIndex];
  const distillery = ensureDistillery(store, payload.distilleryName, payload.country, payload.region);
  const bottler = ensureBottler(
    store,
    payload.bottlerName,
    payload.bottlerKind,
    payload.country
  );
  const updatedExpression = buildExpressionRecord(
    previousExpression.id,
    previousExpression,
    payload,
    distillery.id,
    bottler.id
  );

  store.expressions[expressionIndex] = updatedExpression;
  store.collectionItems[itemIndex] = buildCollectionItemRecord(
    existingItem.id,
    existingItem.expressionId,
    payload,
    existingItem
  );

  if (payload.frontImageUrl) {
    upsertItemImage(store, {
      id: createId("img"),
      collectionItemId: existingItem.id,
      kind: "front",
      url: payload.frontImageUrl,
      label: normalizeText(payload.frontImageLabel) ?? "Uploaded front label"
    });
  }

  if (previousExpression.distilleryId !== updatedExpression.distilleryId) {
    pruneUnusedDistillery(store, previousExpression.distilleryId);
  }

  if (previousExpression.bottlerId !== updatedExpression.bottlerId) {
    pruneUnusedBottler(store, previousExpression.bottlerId);
  }

  await writeStore(store);
  return store.collectionItems[itemIndex];
}

export async function deleteItem(itemId: string) {
  const store = await readStore();
  const item = store.collectionItems.find((entry) => entry.id === itemId);

  if (!item) {
    return false;
  }

  store.tastingEntries = store.tastingEntries.filter(
    (entry) => entry.collectionItemId !== itemId
  );
  store.itemImages = store.itemImages.filter((entry) => entry.collectionItemId !== itemId);
  store.collectionItems = store.collectionItems.filter((entry) => entry.id !== itemId);
  removeExpressionIfOrphaned(store, item.expressionId);

  await writeStore(store);
  return true;
}

export async function addTastingEntry(
  itemId: string,
  payload: Omit<TastingEntry, "id" | "collectionItemId">
) {
  const store = await readStore();
  const item = store.collectionItems.find((entry) => entry.id === itemId);

  if (!item) {
    return null;
  }

  const entry: TastingEntry = {
    id: createId("taste"),
    collectionItemId: itemId,
    ...payload
  };

  store.tastingEntries.unshift(entry);
  item.updatedAt = new Date().toISOString();
  await writeStore(store);
  return entry;
}

export async function getAnalytics() {
  const collection = await getCollectionView();
  return buildCollectionAnalytics(collection);
}

export async function getPalateProfile() {
  const collection = await getCollectionView();
  return buildPalateProfile(collection.filter((entry) => entry.item.status === "owned"));
}

export async function getAdvisor(kind: "drink-now" | "buy-next") {
  const collection = await getCollectionView();
  const profile = buildPalateProfile(collection.filter((entry) => entry.item.status === "owned"));

  return kind === "drink-now"
    ? buildDrinkNowSuggestions(collection, profile)
    : buildBuyNextSuggestions(collection, profile);
}

export async function getPricing(itemId: string) {
  const item = await getItemById(itemId);
  return item?.priceSnapshot ?? null;
}

export async function compareWhiskies(leftId: string, rightId: string) {
  const store = await readStore();
  const collection = toCollectionViewItems(store);
  const left =
    collection.find(({ item, expression }) => item.id === leftId || expression.id === leftId) ??
    toExpressionView(store, leftId);
  const right =
    collection.find(({ item, expression }) => item.id === rightId || expression.id === rightId) ??
    toExpressionView(store, rightId);

  if (!left || !right) {
    return null;
  }

  return buildComparison(left, right);
}

export async function exportCollection(format: "csv" | "json") {
  const collection = await getCollectionView();

  if (format === "json") {
    return JSON.stringify(collection, null, 2);
  }

  const rows = collection.map(
    ({ item, expression, distillery, bottler, latestTasting, priceSnapshot }) => ({
      expression: expression.name,
      brand: expression.brand ?? "",
      distillery: distillery.name,
      bottler: bottler.name,
      bottlerKind: expression.bottlerKind,
      releaseSeries: expression.releaseSeries ?? "",
      ageStatement: expression.ageStatement ?? "",
      volumeMl: expression.volumeMl ?? "",
      isNas: expression.isNas ? "yes" : "no",
      isChillFiltered: expression.isChillFiltered ? "yes" : "no",
      isNaturalColor: expression.isNaturalColor ? "yes" : "no",
      isLimited: expression.isLimited ? "yes" : "no",
      status: item.status,
      fillState: item.fillState,
      purchasePrice: item.purchasePrice ?? "",
      purchaseCurrency: item.purchaseCurrency,
      purchaseSource: item.purchaseSource ?? "",
      region: expression.region,
      peatLevel: expression.peatLevel,
      caskInfluence: expression.caskInfluence,
      rating: latestTasting?.rating ?? "",
      marketLowZar: priceSnapshot?.retail?.lowZar ?? "",
      marketHighZar: priceSnapshot?.retail?.highZar ?? ""
    })
  );

  return Papa.unparse(rows);
}

export async function getDrafts() {
  const store = await readStore();
  return store.drafts;
}

export async function getDraftById(draftId: string) {
  const store = await readStore();
  return store.drafts.find((entry) => entry.id === draftId) ?? null;
}
