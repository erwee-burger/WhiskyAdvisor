import type { CollectionViewItem } from "@/lib/types";

export interface CollectionFilters {
  tags: string[];
  brands: string[];
  distilleries: string[];
  bottlers: string[];
  countries: string[];
  purchaseSources: string[];
  fillStates: string[];
  abvBuckets: string[];
  ageBuckets: string[];
  priceMin?: number;
  priceMax?: number;
  ratings: number[];
  favoritesOnly: boolean;
}

export const DEFAULT_FILTERS: CollectionFilters = {
  tags: [],
  brands: [],
  distilleries: [],
  bottlers: [],
  countries: [],
  purchaseSources: [],
  fillStates: [],
  abvBuckets: [],
  ageBuckets: [],
  ratings: [],
  favoritesOnly: false
};

export function hasActiveFilters(filters: CollectionFilters): boolean {
  return (
    filters.tags.length > 0 ||
    filters.brands.length > 0 ||
    filters.distilleries.length > 0 ||
    filters.bottlers.length > 0 ||
    filters.countries.length > 0 ||
    filters.purchaseSources.length > 0 ||
    filters.fillStates.length > 0 ||
    filters.abvBuckets.length > 0 ||
    filters.ageBuckets.length > 0 ||
    filters.ratings.length > 0 ||
    filters.favoritesOnly ||
    filters.priceMin !== undefined ||
    filters.priceMax !== undefined
  );
}

function abvBucketMatches(abv: number | undefined, buckets: string[]): boolean {
  if (buckets.length === 0) return true;
  if (abv === undefined) return false;
  return buckets.some((bucket) => {
    if (bucket === "under-46") return abv < 46;
    if (bucket === "46-55") return abv >= 46 && abv <= 55;
    if (bucket === "55-plus") return abv > 55;
    return false;
  });
}

function ageBucketMatches(ageStatement: number | undefined, nasTag: boolean, buckets: string[]): boolean {
  if (buckets.length === 0) return true;
  return buckets.some((bucket) => {
    if (bucket === "nas") return nasTag || ageStatement === undefined;
    if (bucket === "under-12") return ageStatement !== undefined && ageStatement < 12;
    if (bucket === "12-18") return ageStatement !== undefined && ageStatement >= 12 && ageStatement <= 18;
    if (bucket === "18-25") return ageStatement !== undefined && ageStatement > 18 && ageStatement <= 25;
    if (bucket === "25-plus") return ageStatement !== undefined && ageStatement > 25;
    return false;
  });
}

export function applyFilters(
  collection: CollectionViewItem[],
  filters: CollectionFilters
): CollectionViewItem[] {
  return collection.filter((entry) => {
    const { expression, item } = entry;

    if (filters.tags.length > 0 && !filters.tags.some((t) => expression.tags.includes(t))) return false;
    if (filters.brands.length > 0 && (!expression.brand || !filters.brands.includes(expression.brand)))
      return false;
    if (
      filters.distilleries.length > 0 &&
      (!expression.distilleryName || !filters.distilleries.includes(expression.distilleryName))
    )
      return false;
    if (
      filters.bottlers.length > 0 &&
      (!expression.bottlerName || !filters.bottlers.includes(expression.bottlerName))
    )
      return false;
    if (
      filters.countries.length > 0 &&
      (!expression.country || !filters.countries.includes(expression.country))
    )
      return false;
    if (
      filters.purchaseSources.length > 0 &&
      (!item.purchaseSource || !filters.purchaseSources.includes(item.purchaseSource))
    )
      return false;
    if (filters.fillStates.length > 0 && !filters.fillStates.includes(item.fillState)) return false;
    if (!abvBucketMatches(expression.abv, filters.abvBuckets)) return false;
    if (!ageBucketMatches(expression.ageStatement, expression.tags.includes("nas"), filters.ageBuckets))
      return false;
    if (filters.priceMin !== undefined && (item.purchasePrice === undefined || item.purchasePrice < filters.priceMin))
      return false;
    if (filters.priceMax !== undefined && (item.purchasePrice === undefined || item.purchasePrice > filters.priceMax))
      return false;
    if (filters.ratings.length > 0 && (!item.rating || !filters.ratings.includes(item.rating))) return false;
    if (filters.favoritesOnly && !item.isFavorite) return false;

    return true;
  });
}

export function filtersFromSearchParams(params: URLSearchParams): CollectionFilters {
  const filters: CollectionFilters = { ...DEFAULT_FILTERS };

  const distilleries = params.getAll("distillery");
  if (distilleries.length > 0) filters.distilleries = distilleries;

  const bottlers = params.getAll("bottler");
  if (bottlers.length > 0) filters.bottlers = bottlers;

  const brands = params.getAll("brand");
  if (brands.length > 0) filters.brands = brands;

  const countries = params.getAll("country");
  if (countries.length > 0) filters.countries = countries;

  const tags = params.getAll("tag");
  if (tags.length > 0) filters.tags = tags;

  const fillStates = params.getAll("fillState");
  if (fillStates.length > 0) filters.fillStates = fillStates;

  const ratings = params
    .getAll("rating")
    .map(Number)
    .filter((n) => n >= 1 && n <= 3);
  if (ratings.length > 0) filters.ratings = ratings;

  if (params.get("favorites") === "true") filters.favoritesOnly = true;

  const abv = params.getAll("abv");
  if (abv.length > 0) filters.abvBuckets = abv;

  const age = params.getAll("age");
  if (age.length > 0) filters.ageBuckets = age;

  const priceMin = params.get("priceMin");
  if (priceMin !== null) filters.priceMin = Number(priceMin);

  const priceMax = params.get("priceMax");
  if (priceMax !== null) filters.priceMax = Number(priceMax);

  return filters;
}
