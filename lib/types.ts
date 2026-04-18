// lib/types.ts

export type CollectionStatus = "owned" | "wishlist";
export type FillState = "sealed" | "open" | "finished";
export type IntakeSource = "photo" | "barcode" | "hybrid" | "search";
export type RelationshipType = "friend" | "family" | "colleague" | "other";
export type OccasionType = "visit" | "whisky_friday" | "other";

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
  tastingNotes: string[];
}

export type FlavorPillar =
  | "smoky"
  | "sweet"
  | "spicy"
  | "fruity"
  | "oaky"
  | "floral"
  | "malty"
  | "coastal";

export interface ExpressionFlavorProfile {
  id: string;
  expressionId: string;
  pillars: Record<FlavorPillar, number>;
  topNotes: string[];
  confidence: number;
  evidenceCount: number;
  explanation: string;
  scoringVersion: string;
  modelVersion: string;
  generatedAt: string;
  staleAt?: string;
  createdAt: string;
  updatedAt: string;
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

export interface TastingEntry {
  id: string;
  collectionItemId: string;
  tastedAt: string;
  rating?: 1 | 2 | 3;
  notes?: string;
}

export interface TastingPerson {
  id: string;
  name: string;
  relationshipType: RelationshipType;
  preferenceTags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TastingGroup {
  id: string;
  name: string;
  notes?: string;
  memberPersonIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TastingPlace {
  id: string;
  name: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TastingSession {
  id: string;
  title?: string;
  occasionType: OccasionType;
  sessionDate: string;
  placeId?: string;
  groupId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TastingSessionAttendee {
  id: string;
  sessionId: string;
  personId: string;
}

export interface TastingSessionBottle {
  id: string;
  sessionId: string;
  collectionItemId: string;
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
  flavorProfile?: ExpressionFlavorProfile;
  images: ItemImage[];
  tastingEntries?: TastingEntry[];
  latestTasting?: TastingEntry;
  priceSnapshot?: {
    retail?: { low: number; high: number; currency: string };
    auction?: { low: number; high: number; currency: string };
  };
  distillery?: { name: string };
  bottler?: { name: string };
}

export interface TastingSessionView {
  session: TastingSession;
  place?: TastingPlace;
  group?: TastingGroup;
  attendees: TastingPerson[];
  bottles: CollectionViewItem[];
}

export interface BottleSocialSummary {
  collectionItemId: string;
  lastSharedAt?: string;
  people: Array<{
    personId: string;
    name: string;
    relationshipType: RelationshipType;
    preferenceTags: string[];
    lastTastedAt: string;
  }>;
  groups: Array<{ groupId: string; name: string; lastSessionAt: string }>;
  places: Array<{ placeId: string; name: string; lastSessionAt: string }>;
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

  };
  ratingDistribution: Array<{ rating: number; count: number; label: string }>;
  regionSplit: Array<{ region: string; count: number }>;
  peatProfile: Array<{ tag: string; count: number; peatLevel?: string }>;
  topDistilleries: Array<{ name: string; count: number }>;
  topBottlers: Array<{ name: string; count: number }>;
  tasteIdentity: {
    profileCoverage: {
      profiledOwnedCount: number;
      totalOwnedCount: number;
      percent: number;
    };
    pillarAverages: Record<FlavorPillar, number>;
    strongestPillars: Array<{ pillar: FlavorPillar; value: number }>;
    weakestPillars: Array<{ pillar: FlavorPillar; value: number }>;
    topNotes: Array<{ note: string; count: number }>;
    dominantSummary: string;
  };
  collectionShape: {
    caskStyles: Array<{ tag: string; label: string; count: number; share: number }>;
    peatLevels: Array<{ tag: string; label: string; count: number; share: number }>;
    independentVsOfficial: {
      independent: number;
      official: number;
    };
    regionConcentration: number;
    distilleryConcentration: number;
    topRegionShare: number;
    topDistilleryShare: number;
  };
  ratingsInsight: {
    ratedCount: number;
    favoriteCount: number;
    favoriteRate: number;
    averageRating: number | null;
    unratedOwnedCount: number;
    topRatedRegions: Array<{ region: string; count: number }>;
    topRatedCaskStyles: Array<{ tag: string; label: string; count: number }>;
  };
  spendInsight: {
    paidTotalZar: number;
    averageOwnedBottlePriceZar: number | null;
    medianOwnedBottlePriceZar: number | null;
  };
  blindSpots: Array<{
    title: string;
    detail: string;
    tone: "gap" | "bias" | "opportunity";
  }>;
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
  /** Top tasting notes seen across the user's highest-rated bottles. */
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
  expressionFlavorProfiles: ExpressionFlavorProfile[];
  collectionItems: CollectionItem[];
  itemImages: ItemImage[];
  tastingEntries?: TastingEntry[];
  tastingPeople?: TastingPerson[];
  tastingGroups?: TastingGroup[];
  tastingPlaces?: TastingPlace[];
  tastingSessions?: TastingSession[];
  tastingSessionAttendees?: TastingSessionAttendee[];
  tastingSessionBottles?: TastingSessionBottle[];
  drafts: IntakeDraft[];
}

// ── News v2 ──────────────────────────────────────────────────────────────────

export type BudgetFit = "in_budget" | "stretch" | "over_budget" | "above_budget";

export interface NewsBudgetPreferences {
  softBudgetCapZar: number;
  stretchBudgetCapZar: number | null;
}

export interface NewsFeedItem {
  id: string;
  source: string;
  kind: "special" | "new_release";
  name: string;
  price: number;
  originalPrice?: number;
  discountPct?: number;
  url: string;
  imageUrl?: string;
  inStock: boolean;
  relevanceScore: number;
  budgetFit: BudgetFit;
  whyItMatters: string | null;
  citations: string[];
}

export interface NewsSummaryCard {
  cardType: "best_value" | "worth_stretching" | "most_interesting";
  title: string;
  subtitle?: string;
  price?: number;
  url?: string;
  whyItMatters?: string;
  source?: string;
}

export interface NewsSnapshotResponse {
  specials: NewsFeedItem[];
  newArrivals: NewsFeedItem[];
  summaryCards: NewsSummaryCard[];
  fetchedAt: string | null;
  stale: boolean;
  preferences: NewsBudgetPreferences;
}

export type NewsAffinityBand = "strong_fit" | "good_fit" | "outside_usual_lane";

export interface NewsAffinity {
  score: number;
  band: NewsAffinityBand;
  reasons: string[];
}

export type NewsBudgetFilter = "all" | "in_budget" | "stretch" | "over_budget_or_above";
export type NewsFreshnessFilter = "all" | "new_to_you" | "seen";
export type NewsSortOption =
  | "recommended"
  | "best_fit"
  | "price_low_to_high"
  | "price_high_to_low"
  | "biggest_discount";

export interface NewsUiFilters {
  retailer: string;
  budget: NewsBudgetFilter;
  palateFit: "all" | NewsAffinityBand;
  freshness: NewsFreshnessFilter;
}
