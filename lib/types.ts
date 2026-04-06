export const BOTTLER_KIND_VALUES = ["official", "independent"] as const;
export type BottlerKind = (typeof BOTTLER_KIND_VALUES)[number];
export type CollectionStatus = "owned" | "wishlist";
export type FillState = "sealed" | "open" | "finished";
export const WHISKY_TYPE_VALUES = [
  "single-malt",
  "blended-malt",
  "blended-scotch",
  "single-grain",
  "world-single-malt"
] as const;
export type WhiskyType = (typeof WHISKY_TYPE_VALUES)[number];
export const PEAT_LEVEL_VALUES = ["unpeated", "light", "medium", "heavily-peated"] as const;
export type PeatLevel = (typeof PEAT_LEVEL_VALUES)[number];
export const CASK_INFLUENCE_VALUES = [
  "bourbon",
  "sherry",
  "wine",
  "rum",
  "virgin-oak",
  "mixed",
  "refill"
] as const;
export type CaskInfluence = (typeof CASK_INFLUENCE_VALUES)[number];
export type SourceKind = "official" | "retail" | "auction" | "editorial" | "ai";
export type PriceSourceKind = "retail" | "auction";
export type IntakeSource = "photo" | "barcode" | "hybrid";

export interface Distillery {
  id: string;
  name: string;
  country: string;
  region: string;
  foundedYear?: number;
  notes?: string;
}

export interface Bottler {
  id: string;
  name: string;
  bottlerKind: BottlerKind;
  country?: string;
  notes?: string;
}

export interface Expression {
  id: string;
  name: string;
  brand?: string;
  distilleryId: string;
  bottlerId: string;
  bottlerKind: BottlerKind;
  whiskyType: WhiskyType;
  releaseSeries?: string;
  country: string;
  region: string;
  abv: number;
  ageStatement?: number;
  isNas: boolean;
  vintageYear?: number;
  distilledYear?: number;
  bottledYear?: number;
  volumeMl?: number;
  caskType?: string;
  caskNumber?: string;
  bottleNumber?: number;
  outturn?: number;
  peatLevel: PeatLevel;
  caskInfluence: CaskInfluence;
  isChillFiltered: boolean;
  isNaturalColor: boolean;
  isLimited: boolean;
  flavorTags: string[];
  barcode?: string;
  description?: string;
  imageUrl?: string;
}

export interface CollectionItem {
  id: string;
  expressionId: string;
  status: CollectionStatus;
  fillState: FillState;
  purchasePrice?: number;
  purchaseCurrency: string;
  purchaseDate?: string;
  purchaseSource?: string;
  openedDate?: string;
  finishedDate?: string;
  personalNotes?: string;
  draft?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TastingEntry {
  id: string;
  collectionItemId: string;
  tastedAt: string;
  nose: string;
  palate: string;
  finish: string;
  overallNote: string;
  rating: 1 | 2 | 3 | 4 | 5;
}

export interface ItemImage {
  id: string;
  collectionItemId: string;
  kind: "front" | "back" | "detail";
  url: string;
  label?: string;
}

export interface Citation {
  id: string;
  entityType: "expression" | "pricing" | "comparison";
  entityId: string;
  field: string;
  label: string;
  url: string;
  sourceKind: SourceKind;
  confidence: number;
  snippet?: string;
  createdAt: string;
}

export interface PricePoint {
  label: string;
  url: string;
  currency: string;
  amount: number;
  normalizedZar: number;
  confidence: number;
}

export interface PriceRange {
  sourceKind: PriceSourceKind;
  currency: string;
  low: number;
  high: number;
  lowZar: number;
  highZar: number;
  confidence: number;
  refreshedAt: string;
  sources: PricePoint[];
}

export interface PriceSnapshot {
  id: string;
  expressionId: string;
  refreshedAt: string;
  retail?: PriceRange;
  auction?: PriceRange;
}

export interface FieldSuggestion {
  field: string;
  label: string;
  value: string | number | string[] | boolean | undefined;
  confidence: number;
  citationIds: string[];
}

export interface IntakeReviewItem {
  field: string;
  label: string;
  rawValue: string | number | string[] | boolean | undefined;
  suggestedValue: string | number | string[] | boolean | undefined;
  confidence: number;
  needsReview: boolean;
  note?: string;
}

export interface IntakeRawExpression {
  distilleryName?: string;
  bottlerName?: string;
  brand?: string;
  name: string;
  releaseSeries?: string;
  bottlerKind?: string;
  whiskyType?: string;
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
  peatLevel?: string;
  caskInfluence?: string;
  isChillFiltered?: boolean;
  isNaturalColor?: boolean;
  isLimited?: boolean;
  isNas?: boolean;
  flavorTags?: string[];
  description?: string;
}

export interface IntakeDraft {
  id: string;
  collectionItemId: string;
  matchedExpressionId?: string;
  source: IntakeSource;
  barcode?: string;
  rawExpression?: IntakeRawExpression;
  expression: (Partial<Expression> & Pick<Expression, "name">) & {
    distilleryName?: string;
    bottlerName?: string;
  };
  collection: Partial<CollectionItem>;
  suggestions: FieldSuggestion[];
  reviewItems: IntakeReviewItem[];
  citations: Citation[];
}

export interface CollectionViewItem {
  item: CollectionItem;
  expression: Expression;
  distillery: Distillery;
  bottler: Bottler;
  tastingEntries: TastingEntry[];
  latestTasting?: TastingEntry;
  priceSnapshot?: PriceSnapshot;
  images: ItemImage[];
}

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
    withVolume: number;
    averageVolumeMl: number | null;
  };
  ratingDistribution: Array<{
    rating: number;
    count: number;
  }>;
  regionSplit: Array<{
    region: string;
    count: number;
  }>;
  peatProfile: Array<{
    peatLevel: PeatLevel;
    count: number;
  }>;
  topDistilleries: Array<{
    name: string;
    count: number;
  }>;
  topBottlers: Array<{
    name: string;
    count: number;
  }>;
  marketValue: {
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

export interface PalateProfile {
  cards: PalateCard[];
  favoredFlavorTags: string[];
  favoredRegions: string[];
  favoredCaskStyles: string[];
  favoredPeatLevel: PeatLevel;
}

export interface AdvisorSuggestion {
  itemId: string;
  expressionId: string;
  title: string;
  score: number;
  rationale: string;
  supportingTags: string[];
}

export interface ComparisonColumn {
  title: string;
  expressionId?: string;
  displayName: string;
  brand?: string;
  distillery: string;
  bottler: string;
  releaseSeries?: string;
  ageStatement?: number;
  volumeMl?: number;
  isNas: boolean;
  isChillFiltered: boolean;
  isNaturalColor: boolean;
  isLimited: boolean;
  priceSnapshot?: PriceSnapshot;
  latestTasting?: TastingEntry;
  flavorTags: string[];
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
  palateFit: {
    left: string;
    right: string;
  };
}

export interface WhiskyStore {
  distilleries: Distillery[];
  bottlers: Bottler[];
  expressions: Expression[];
  collectionItems: CollectionItem[];
  tastingEntries: TastingEntry[];
  itemImages: ItemImage[];
  citations: Citation[];
  priceSnapshots: PriceSnapshot[];
  drafts: IntakeDraft[];
}
