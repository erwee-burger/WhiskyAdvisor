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
  CollectionItem,
  CollectionStatus,
  CollectionViewItem,
  Distillery,
  Expression,
  FillState,
  PriceSnapshot,
  TastingEntry,
  WhiskyStore
} from "@/lib/types";

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
    distilleryId: createId("dist"),
    bottlerId: createId("bot"),
    bottlerKind: "official",
    whiskyType: "single-malt",
    country: "Unknown",
    region: "Unknown",
    abv: 46,
    ageStatement: undefined,
    vintageYear: undefined,
    distilledYear: undefined,
    bottledYear: undefined,
    caskType: undefined,
    caskNumber: undefined,
    bottleNumber: undefined,
    outturn: undefined,
    peatLevel: "medium",
    caskInfluence: "mixed",
    flavorTags: ["malt"],
    barcode,
    description: undefined
  };
}

function ensureBaseDistilleryAndBottler(store: WhiskyStore) {
  let distillery: Distillery | undefined = store.distilleries[0];
  let bottler: Bottler | undefined = store.bottlers[0];

  if (!distillery) {
    distillery = {
      id: createId("dist"),
      name: "Unknown Distillery",
      country: "Unknown",
      region: "Unknown"
    };
    store.distilleries.unshift(distillery);
  }

  if (!bottler) {
    bottler = {
      id: createId("bot"),
      name: "Unknown Bottler",
      bottlerKind: "official"
    };
    store.bottlers.unshift(bottler);
  }

  return { distillery, bottler };
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

export async function createDraftFromPhoto(fileName: string, imageBase64?: string) {
  const store = await readStore();
  const aiResult = await analyzeBottleImage(fileName, imageBase64);
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
  const draft = buildDraftFromMatchedExpression(expression, aiResult ? "hybrid" : "photo");
  if (!matched) {
    draft.matchedExpressionId = undefined;
  }

  if (aiResult?.expression) {
    draft.expression = {
      ...draft.expression,
      ...aiResult.expression
    };
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
  payload: {
    name: string;
    status: CollectionStatus;
    fillState: FillState;
    purchaseCurrency: string;
    purchasePrice?: number;
    purchaseDate?: string;
    purchaseSource?: string;
    personalNotes?: string;
  }
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

  if (!baseExpression) {
    const { distillery, bottler } = ensureBaseDistilleryAndBottler(store);
    store.expressions.unshift({
      ...draft.expression,
      id: expressionId,
      distilleryId: distillery.id,
      bottlerId: bottler.id,
      bottlerKind: "official",
      whiskyType: "single-malt",
      country: "Unknown",
      region: "Unknown",
      abv: 46,
      peatLevel: "medium",
      caskInfluence: "mixed",
      flavorTags: ["malt"],
      name: payload.name
    });
  }

  const now = new Date().toISOString();
  const item: CollectionItem = {
    id: draft.collectionItemId,
    expressionId,
    status: payload.status,
    fillState: payload.fillState,
    purchaseCurrency: payload.purchaseCurrency,
    purchasePrice: payload.purchasePrice,
    purchaseDate: payload.purchaseDate,
    purchaseSource: payload.purchaseSource,
    personalNotes: payload.personalNotes,
    createdAt: now,
    updatedAt: now
  };

  store.collectionItems.unshift(item);
  store.citations.unshift(...draft.citations);
  store.drafts.splice(draftIndex, 1);
  await writeStore(store);
  return item;
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
      distillery: distillery.name,
      bottler: bottler.name,
      bottlerKind: expression.bottlerKind,
      releaseSeries: expression.releaseSeries ?? "",
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
