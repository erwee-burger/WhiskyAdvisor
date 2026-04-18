import { SOURCE_LABELS } from "@/lib/news-sources";
import { getNewsAffinity, hasMeaningfulNewsProfile } from "@/lib/news-affinity";
import { getNewsItemVisitKey } from "@/lib/news-visit";
import type {
  NewsAffinity,
  NewsFeedItem,
  NewsSortOption,
  NewsUiFilters,
  PalateProfile
} from "@/lib/types";

export interface NewsBrowseItem {
  item: NewsFeedItem;
  affinity: NewsAffinity | null;
  visitState?: "new_to_you" | "seen";
  reasonTags: string[];
  signalLabel: string;
  saveAmount?: number;
}

export interface NewsBrowseResult {
  retailers: string[];
  showPalateFit: boolean;
  hasActiveFilters: boolean;
  specials: NewsBrowseItem[];
  newArrivals: NewsBrowseItem[];
}

export const DEFAULT_NEWS_UI_FILTERS: NewsUiFilters = {
  retailer: "all",
  budget: "all",
  palateFit: "all",
  freshness: "all"
};

function budgetMatches(item: NewsFeedItem, filter: NewsUiFilters["budget"]): boolean {
  if (filter === "all") return true;
  if (filter === "over_budget_or_above") {
    return item.budgetFit === "over_budget" || item.budgetFit === "above_budget";
  }
  return item.budgetFit === filter;
}

function freshnessRank(visitState?: "new_to_you" | "seen"): number {
  return visitState === "new_to_you" ? 1 : 0;
}

function affinityRank(affinity: NewsAffinity | null): number {
  return affinity?.score ?? 0;
}

function compareNumbers(left: number, right: number): number {
  return left === right ? 0 : left > right ? -1 : 1;
}

function compareAscending(left: number, right: number): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

function compareRecommended(left: NewsBrowseItem, right: NewsBrowseItem, kind: NewsFeedItem["kind"]): number {
  const freshCompare = compareNumbers(freshnessRank(left.visitState), freshnessRank(right.visitState));
  if (freshCompare !== 0) return freshCompare;

  const fitCompare = compareNumbers(affinityRank(left.affinity), affinityRank(right.affinity));
  if (fitCompare !== 0) return fitCompare;

  if (kind === "special") {
    const discountCompare = compareNumbers(left.item.discountPct ?? 0, right.item.discountPct ?? 0);
    if (discountCompare !== 0) return discountCompare;
  }

  const relevanceCompare = compareNumbers(left.item.relevanceScore, right.item.relevanceScore);
  if (relevanceCompare !== 0) return relevanceCompare;

  return compareAscending(left.item.price, right.item.price);
}

function compareBrowseItems(
  left: NewsBrowseItem,
  right: NewsBrowseItem,
  sortOption: NewsSortOption,
  kind: NewsFeedItem["kind"]
): number {
  switch (sortOption) {
    case "best_fit": {
      const fitCompare = compareNumbers(affinityRank(left.affinity), affinityRank(right.affinity));
      if (fitCompare !== 0) return fitCompare;
      const freshCompare = compareNumbers(freshnessRank(left.visitState), freshnessRank(right.visitState));
      if (freshCompare !== 0) return freshCompare;
      return compareRecommended(left, right, kind);
    }
    case "price_low_to_high":
      return compareAscending(left.item.price, right.item.price);
    case "price_high_to_low":
      return compareNumbers(left.item.price, right.item.price);
    case "biggest_discount":
      if (kind === "special") {
        const discountCompare = compareNumbers(left.item.discountPct ?? 0, right.item.discountPct ?? 0);
        if (discountCompare !== 0) return discountCompare;
      }
      return compareRecommended(left, right, kind);
    case "recommended":
    default:
      return compareRecommended(left, right, kind);
  }
}

function deriveSignalLabel(item: NewsFeedItem): string {
  if (item.kind === "special") {
    if (item.originalPrice && item.originalPrice > item.price) {
      return `Save R ${(item.originalPrice - item.price).toLocaleString("en-ZA")}`;
    }
    return "Special listing";
  }

  return /\b(cask strength|single cask|limited|edition|release|batch|annual)\b/i.test(item.name)
    ? "Notable release"
    : "Just landed";
}

function deriveBrowseItem(
  item: NewsFeedItem,
  profile: PalateProfile | null,
  showVisitState: boolean,
  unseenKeySet: Set<string>
): NewsBrowseItem {
  const affinity = getNewsAffinity(item, profile);
  const visitState = showVisitState
    ? unseenKeySet.has(getNewsItemVisitKey(item))
      ? "new_to_you"
      : "seen"
    : undefined;

  return {
    item,
    affinity,
    visitState,
    reasonTags: affinity?.reasons.slice(0, 2) ?? [],
    signalLabel: deriveSignalLabel(item),
    saveAmount: item.originalPrice && item.originalPrice > item.price ? item.originalPrice - item.price : undefined
  };
}

function matchesFilters(
  browseItem: NewsBrowseItem,
  filters: NewsUiFilters,
  showVisitState: boolean
): boolean {
  if (filters.retailer !== "all" && browseItem.item.source !== filters.retailer) {
    return false;
  }

  if (!budgetMatches(browseItem.item, filters.budget)) {
    return false;
  }

  if (filters.palateFit !== "all" && browseItem.affinity?.band !== filters.palateFit) {
    return false;
  }

  if (showVisitState && filters.freshness !== "all" && browseItem.visitState !== filters.freshness) {
    return false;
  }

  return true;
}

function sortItems(
  items: NewsBrowseItem[],
  sortOption: NewsSortOption,
  kind: NewsFeedItem["kind"]
): NewsBrowseItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const result = compareBrowseItems(left.item, right.item, sortOption, kind);
      return result !== 0 ? result : left.index - right.index;
    })
    .map(({ item }) => item);
}

export function getNewsRetailers(items: NewsFeedItem[]): string[] {
  return [...new Set(items.map((item) => item.source))].sort((left, right) =>
    (SOURCE_LABELS[left] ?? left).localeCompare(SOURCE_LABELS[right] ?? right)
  );
}

export function hasActiveNewsFilters(filters: NewsUiFilters): boolean {
  return (
    filters.retailer !== DEFAULT_NEWS_UI_FILTERS.retailer ||
    filters.budget !== DEFAULT_NEWS_UI_FILTERS.budget ||
    filters.palateFit !== DEFAULT_NEWS_UI_FILTERS.palateFit ||
    filters.freshness !== DEFAULT_NEWS_UI_FILTERS.freshness
  );
}

export function buildNewsBrowseResult(params: {
  specials: NewsFeedItem[];
  newArrivals: NewsFeedItem[];
  filters: NewsUiFilters;
  sortOption: NewsSortOption;
  profile: PalateProfile | null;
  showVisitState: boolean;
  unseenItemKeys: string[];
}): NewsBrowseResult {
  const { specials, newArrivals, filters, sortOption, profile, showVisitState, unseenItemKeys } = params;
  const unseenKeySet = new Set(unseenItemKeys);
  const showPalateFit = hasMeaningfulNewsProfile(profile);
  const allItems = [...specials, ...newArrivals];
  const retailers = getNewsRetailers(allItems);

  const specialsWithState = specials.map((item) => deriveBrowseItem(item, showPalateFit ? profile : null, showVisitState, unseenKeySet));
  const arrivalsWithState = newArrivals.map((item) =>
    deriveBrowseItem(item, showPalateFit ? profile : null, showVisitState, unseenKeySet)
  );

  const normalizedFilters: NewsUiFilters = showPalateFit
    ? filters
    : { ...filters, palateFit: "all" };

  return {
    retailers,
    showPalateFit,
    hasActiveFilters: hasActiveNewsFilters({
      ...normalizedFilters,
      freshness: showVisitState ? normalizedFilters.freshness : "all"
    }),
    specials: sortItems(
      specialsWithState.filter((item) => matchesFilters(item, normalizedFilters, showVisitState)),
      sortOption,
      "special"
    ),
    newArrivals: sortItems(
      arrivalsWithState.filter((item) => matchesFilters(item, normalizedFilters, showVisitState)),
      sortOption,
      "new_release"
    )
  };
}
