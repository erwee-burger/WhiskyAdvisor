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
  barcode?: string;
  description?: string;
  imageUrl?: string;
  tags: string[];
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
  personalNotes?: string;
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
  tastingEntries: TastingEntry[];
  latestTasting?: TastingEntry;
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
  };
  ratingDistribution: Array<{ rating: number; count: number }>;
  regionSplit: Array<{ region: string; count: number }>;
  peatProfile: Array<{ tag: string; count: number }>;
  topDistilleries: Array<{ name: string; count: number }>;
  topBottlers: Array<{ name: string; count: number }>;
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
  latestTasting?: TastingEntry;
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
  tastingEntries: TastingEntry[];
  itemImages: ItemImage[];
  drafts: IntakeDraft[];
}
