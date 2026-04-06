import Papa from "papaparse";

import { buildBuyNextSuggestions, buildDrinkNowSuggestions } from "@/lib/advisor";
import { buildCollectionAnalytics } from "@/lib/analytics";
import { buildComparison } from "@/lib/comparison";
import { createId } from "@/lib/id";
import { readStore, writeStore } from "@/lib/mock-store";
import { analyzeBottleImage, buildDraftFromExpression } from "@/lib/openai";
import { buildPalateProfile } from "@/lib/profile";
import type {
  CollectionItem,
  CollectionStatus,
  CollectionViewItem,
  Expression,
  FillState,
  IntakeDraft,
  ItemImage,
  TastingEntry,
  WhiskyStore
} from "@/lib/types";

type DraftView = {
  draftId: string;
  source: string;
  barcode?: string;
  rawAiResponse?: {
    identificationText?: string;
    enrichmentText?: string;
  };
  expression: Partial<Expression> & Pick<Expression, "name">;
  collection: {
    status: CollectionStatus;
    fillState: FillState;
    purchaseCurrency: string;
  };
};

type BottleRecordPayload = {
  name: string;
  distilleryName?: string;
  bottlerName?: string;
  brand?: string;
  country?: string;
  abv?: number;
  ageStatement?: number;
  barcode?: string;
  description?: string;
  tags: string[];
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


function buildFallbackExpression(name: string, barcode?: string): Expression {
  return {
    id: createId("expr"),
    name,
    barcode,
    tags: []
  };
}



function buildDraftView(store: WhiskyStore, draft: IntakeDraft | null) {
  if (!draft) return null;
  return {
    draftId: draft.id,
    source: draft.source,
    barcode: draft.barcode,
    rawAiResponse: draft.rawAiResponse,
    expression: draft.expression,
    collection: {
      status: (draft.collection.status ?? "owned") as CollectionStatus,
      fillState: (draft.collection.fillState ?? "sealed") as FillState,
      purchaseCurrency: draft.collection.purchaseCurrency ?? "ZAR"
    }
  };
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
  payload: BottleRecordPayload,
  baseExpression?: Expression
): Expression {
  return {
    id: expressionId,
    name: payload.name,
    distilleryName: payload.distilleryName ?? baseExpression?.distilleryName,
    bottlerName: payload.bottlerName ?? baseExpression?.bottlerName,
    brand: payload.brand ?? baseExpression?.brand,
    country: payload.country ?? baseExpression?.country,
    abv: payload.abv ?? baseExpression?.abv,
    ageStatement: payload.ageStatement ?? baseExpression?.ageStatement,
    barcode: payload.barcode ?? baseExpression?.barcode,
    description: payload.description ?? baseExpression?.description,
    imageUrl: baseExpression?.imageUrl,
    tags: payload.tags.length > 0 ? payload.tags : (baseExpression?.tags ?? [])
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
    updatedAt: now
  };
}

function removeExpressionIfOrphaned(store: WhiskyStore, expressionId: string) {
  const stillReferenced = store.collectionItems.some((entry) => entry.expressionId === expressionId);

  if (stillReferenced) {
    return;
  }

  store.expressions = store.expressions.filter((entry) => entry.id !== expressionId);
}

export async function getCollectionView(): Promise<CollectionViewItem[]> {
  const store = await readStore();
  return store.collectionItems.map((item) => {
    const expression = store.expressions.find((e) => e.id === item.expressionId) ?? {
      id: item.expressionId,
      name: "Unknown",
      tags: []
    };
    const tastingEntries = store.tastingEntries.filter(
      (t) => t.collectionItemId === item.id
    );
    const images = store.itemImages.filter((img) => img.collectionItemId === item.id);
    const latestTasting = tastingEntries.length > 0
      ? tastingEntries.reduce((latest, t) =>
          t.tastedAt > latest.tastedAt ? t : latest
        )
      : undefined;
    return { item, expression, tastingEntries, latestTasting, images };
  });
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
    const existingItem = store.collectionItems.find((entry) => entry.expressionId === expression.id);

    return {
      itemId: existingItem?.id ?? expression.id,
      expressionId: expression.id,
      label: `${expression.name}${expression.distilleryName ? ` - ${expression.distilleryName}` : ""}`,
      subtitle: expression.bottlerName ?? "Unknown bottler"
    };
  });
}

export async function createDraftFromBarcode(barcode: string) {
  const store = await readStore();
  const matched =
    store.expressions.find((entry) => entry.barcode === barcode) ??
    store.expressions.find((entry) => barcode && entry.name.toLowerCase().includes(barcode.toLowerCase()));

  const expression = matched ?? buildFallbackExpression(`Unknown whisky (${barcode})`, barcode);
  const draft = buildDraftFromExpression(expression, "barcode", barcode);
  store.drafts.unshift(draft);
  await writeStore(store);
  return draft;
}

export async function createDraftFromPhoto(
  fileName: string,
  imageBase64?: string,
  mimeType = "image/jpeg"
): Promise<IntakeDraft> {
  const store = await readStore();
  const aiResult = await analyzeBottleImage(fileName, imageBase64, mimeType);

  const draft: IntakeDraft = {
    id: createId("draft"),
    collectionItemId: createId("item"),
    source: aiResult ? "hybrid" : "photo",
    rawAiResponse: aiResult?.rawAiResponse,
    expression: aiResult?.expression ?? { name: fileName.replace(/\.[^.]+$/, ""), tags: [] },
    collection: {
      purchaseCurrency: "ZAR",
      status: "owned",
      fillState: "sealed"
    }
  };

  store.drafts.unshift(draft);
  await writeStore(store);
  return draft;
}


export async function saveDraftAsItem(draftId: string, payload: BottleRecordPayload) {
  const store = await readStore();
  const draftIndex = store.drafts.findIndex((entry) => entry.id === draftId);

  if (draftIndex < 0) return null;

  const draft = store.drafts[draftIndex];
  const baseExpression = draft.expression.id
    ? store.expressions.find((entry) => entry.id === draft.expression.id)
    : undefined;
  const expressionId = baseExpression?.id ?? createId("expr");
  const expressionRecord = buildExpressionRecord(expressionId, payload, baseExpression);

  const expressionIndex = store.expressions.findIndex((entry) => entry.id === expressionId);
  if (expressionIndex >= 0) {
    store.expressions[expressionIndex] = expressionRecord;
  } else {
    store.expressions.unshift(expressionRecord);
  }

  const now = new Date().toISOString();
  const collectionItem: CollectionItem = {
    id: draft.collectionItemId,
    expressionId,
    status: payload.status as CollectionStatus,
    fillState: payload.fillState as FillState,
    purchasePrice: payload.purchasePrice,
    purchaseCurrency: payload.purchaseCurrency,
    purchaseDate: payload.purchaseDate,
    purchaseSource: payload.purchaseSource,
    personalNotes: payload.personalNotes,
    createdAt: now,
    updatedAt: now
  };

  store.collectionItems.unshift(collectionItem);

  if (payload.frontImageUrl) {
    store.itemImages.unshift({
      id: createId("img"),
      collectionItemId: collectionItem.id,
      kind: "front",
      url: payload.frontImageUrl,
      label: payload.frontImageLabel
    });
  }

  try {
    // Write the new data first
    await writeStore(store);

    // Only remove the draft after write succeeds
    store.drafts.splice(draftIndex, 1);

    // Write again to persist the draft removal
    await writeStore(store);

    return collectionItem;
  } catch (error) {
    throw new Error(`Failed to save draft as item: ${error instanceof Error ? error.message : String(error)}`);
  }
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
  const updatedExpression = buildExpressionRecord(
    previousExpression.id,
    payload,
    previousExpression
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
      label: payload.frontImageLabel ?? "Uploaded front label"
    });
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

export async function compareWhiskies(leftId: string, rightId: string) {
  const collection = await getCollectionView();
  const left = collection.find(({ item, expression }) => item.id === leftId || expression.id === leftId);
  const right = collection.find(({ item, expression }) => item.id === rightId || expression.id === rightId);

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
    ({ item, expression, latestTasting }) => ({
      expression: expression.name,
      brand: expression.brand ?? "",
      distillery: expression.distilleryName ?? "",
      bottler: expression.bottlerName ?? "",
      abv: expression.abv ?? "",
      ageStatement: expression.ageStatement ?? "",
      barcode: expression.barcode ?? "",
      description: expression.description ?? "",
      status: item.status,
      fillState: item.fillState,
      purchasePrice: item.purchasePrice ?? "",
      purchaseCurrency: item.purchaseCurrency ?? "",
      purchaseSource: item.purchaseSource ?? "",
      rating: latestTasting?.rating ?? "",
      personalNotes: item.personalNotes ?? ""
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
