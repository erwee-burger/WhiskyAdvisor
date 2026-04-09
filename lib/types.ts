// lib/types.ts

export type CollectionStatus = "owned" | "wishlist";
export type FillState = "sealed" | "open" | "finished";
export type IntakeSource = "photo" | "barcode" | "hybrid";

export interface Expression {
  id: string;
  name: string;
  distilleryName?: string;
  bottlerName?: string;
  brand?: string;
  country?: string;
  abv?: number;
  ageStatement?: number;
  releaseSeries?: string;
  bottlerKind?: string;
  whiskyType?: string;
  region?: string;
  volumeMl?: number;
  vintageYear?: number;
  distilledYear?: number;
  bottledYear?: number;
  caskType?: string;
  caskNumber?: string;
  bottleNumber?: number;
  outturn?: number;
  barcode?: string;
  description?: string;
  imageUrl?: string;
  peatLevel?: string;
  caskInfluence?: string;
  isNas?: boolean;
  isChillFiltered?: boolean;
  isNaturalColor?: boolean;
  isLimited?: boolean;
  flavorTags?: string[];
  tags: string[];
}

export interface CollectionItem {
  id: string;
  expressionId: string;
  status: CollectionStatus;
  fillState: FillState;
  purchasePrice?: number;
  purchaseCurrency?: string;
  purchaseDate?: string;
  purchaseSource?: string;
  personalNotes?: string;
  rating?: 1 | 2 | 3;
  isFavorite?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ItemImage {
  id: string;
  collectionItemId: string;
  kind: "front" | "back" | "detail";
  url: string;
  label?: string;
}

/**
 * Represents a bottle entry being drafted during photo/barcode intake.
 * @property rawAiResponse - Raw text outputs from OpenAI identification and enrichment passes
 * @property expression - Partial expression fields; name is required, others optional
 * @property collection - Partial collection metadata (status, fill state, purchase info)
 */
export interface IntakeDraft {
  id: string;
  collectionItemId: string;
  source: IntakeSource;
  barcode?: string;
  rawAiResponse?: {
    identificationText?: string;
    enrichmentText?: string;
  };
  expression: Partial<Expression> & Pick<Expression, "name">;
  collection: Partial<CollectionItem>;
}

export interface CollectionViewItem {
  item: CollectionItem;
  expression: Expression;
  images: ItemImage[];
  priceSnapshot?: {
    retail?: { low: number; high: number; currency: string };
    auction?: { low: number; high: number; currency: string };
  };
  distillery?: { name: string };
  bottler?: { name: string };
}

/**
 * Aggregated analytics across the collection.
 * Includes counts, distributions, and top items by category.
 */
export interface CollectionAnalytics {
  totals: {
    owned: number;
    wishlist: number;
    open: number;
    sealed: number;
    finished: number;
  };
  bottleProfile: {
    brandTagged: number;
    nas: number;
    limited: number;
    chillFiltered: number;
    naturalColor: number;
    averageVolumeMl?: number | null;
    withVolume?: number;
  };
  ratingDistribution: Array<{ rating: number; count: number; label: string }>;
  regionSplit: Array<{ region: string; count: number }>;
  peatProfile: Array<{ tag: string; count: number; peatLevel?: string }>;
  topDistilleries: Array<{ name: string; count: number }>;
  topBottlers: Array<{ name: string; count: number }>;
  marketValue?: {
    paidTotalZar: number;
    marketLowZar: number;
    marketHighZar: number;
  };
}

export interface PalateCard {
  title: string;
  value: string;
  supporting: string;
}

/**
 * User's detected taste profile based on collection and tasting history.
 * @property favoredPeatTag - Most favored peat style tag, or null if insufficient data
 */
export interface PalateProfile {
  cards: PalateCard[];
  favoredFlavorTags: string[];
  favoredRegions: string[];
  favoredCaskStyles: string[];
  favoredPeatTag: string | null;
}

export interface AdvisorSuggestion {
  itemId: string;
  expressionId: string;
  title: string;
  score: number;
  rationale: string;
  supportingTags: string[];
}

/**
 * A single expression in a side-by-side comparison.
 * @property distilleryName - Required: the distillery name for display (cannot be inferred)
 * @property bottlerName - Required: the bottler name for display (cannot be inferred)
 */
export interface ComparisonColumn {
  title: string;
  expressionId?: string;
  displayName: string;
  brand?: string;
  distilleryName: string;
  bottlerName: string;
  ageStatement?: number;
  abv?: number;
  tags: string[];
  rating?: 1 | 2 | 3;
}

export interface ComparisonRow {
  label: string;
  left: string;
  right: string;
}

export interface ComparisonResult {
  left: ComparisonColumn;
  right: ComparisonColumn;
  rows: ComparisonRow[];
  summary: string;
  palateFit: { left: string; right: string };
}

export interface WhiskyStore {
  expressions: Expression[];
  collectionItems: CollectionItem[];
  itemImages: ItemImage[];
  drafts: IntakeDraft[];
  distilleries?: { id: string; name: string }[];
  bottlers?: { id: string; name: string }[];
  priceSnapshots?: unknown[];
  citations?: unknown[];
}

export interface NewsItem {
  source: string;
  kind: "special" | "new_release";
  name: string;
  price: number;
  originalPrice?: number;
  discountPct?: number;
  url: string;
  imageUrl?: string;
  inStock: boolean;
}

export interface ScoredNewsItem extends NewsItem {
  id: string;
  fetchedAt: string;
  palateScore: number;
  palateStars: 0 | 1 | 2 | 3;
}
