import { describe, expect, it } from "vitest";

import { applyFilters, DEFAULT_FILTERS, filtersFromSearchParams, hasActiveFilters } from "@/lib/collection-filters";
import type { CollectionViewItem } from "@/lib/types";

function makeEntry(overrides: {
  tags?: string[];
  brand?: string;
  distilleryName?: string;
  bottlerName?: string;
  country?: string;
  abv?: number;
  ageStatement?: number;
  purchaseSource?: string;
  fillState?: "sealed" | "open" | "finished";
  purchasePrice?: number;
  rating?: 1 | 2 | 3;
  isFavorite?: boolean;
}): CollectionViewItem {
  return {
    item: {
      id: "item-1",
      expressionId: "expr-1",
      status: "owned",
      fillState: overrides.fillState ?? "sealed",
      purchaseSource: overrides.purchaseSource,
      purchasePrice: overrides.purchasePrice,
      rating: overrides.rating,
      isFavorite: overrides.isFavorite,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    },
    expression: {
      id: "expr-1",
      name: "Test Whisky",
      tags: overrides.tags ?? [],
      brand: overrides.brand,
      distilleryName: overrides.distilleryName,
      bottlerName: overrides.bottlerName,
      country: overrides.country,
      abv: overrides.abv,
      ageStatement: overrides.ageStatement
    },
    images: []
  };
}

describe("hasActiveFilters", () => {
  it("returns false for DEFAULT_FILTERS", () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
  });

  it("returns true when any array is non-empty", () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, distilleries: ["Ardbeg"] })).toBe(true);
  });

  it("returns true when favoritesOnly is true", () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, favoritesOnly: true })).toBe(true);
  });

  it("returns true when priceMin is set", () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, priceMin: 500 })).toBe(true);
  });
});

describe("applyFilters — combobox filters", () => {
  it("passes all entries when no filters active", () => {
    const entries = [makeEntry({ distilleryName: "Ardbeg" }), makeEntry({ distilleryName: "Laphroaig" })];
    expect(applyFilters(entries, DEFAULT_FILTERS)).toHaveLength(2);
  });

  it("filters by distillery (OR within type)", () => {
    const ardbeg = makeEntry({ distilleryName: "Ardbeg" });
    const laphroaig = makeEntry({ distilleryName: "Laphroaig" });
    const glenfarclas = makeEntry({ distilleryName: "Glenfarclas" });
    const result = applyFilters([ardbeg, laphroaig, glenfarclas], {
      ...DEFAULT_FILTERS,
      distilleries: ["Ardbeg", "Laphroaig"]
    });
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.expression.distilleryName)).toEqual(["Ardbeg", "Laphroaig"]);
  });

  it("filters by tag (OR within type)", () => {
    const peated = makeEntry({ tags: ["peated", "smoke"] });
    const sherry = makeEntry({ tags: ["sherry-cask"] });
    const result = applyFilters([peated, sherry], { ...DEFAULT_FILTERS, tags: ["peated"] });
    expect(result).toHaveLength(1);
    expect(result[0].expression.tags).toContain("peated");
  });

  it("ANDs across filter types", () => {
    const match = makeEntry({ distilleryName: "Ardbeg", country: "Scotland" });
    const wrongCountry = makeEntry({ distilleryName: "Ardbeg", country: "Japan" });
    const result = applyFilters([match, wrongCountry], {
      ...DEFAULT_FILTERS,
      distilleries: ["Ardbeg"],
      countries: ["Scotland"]
    });
    expect(result).toHaveLength(1);
  });

  it("excludes entry with no distilleryName when distillery filter active", () => {
    const noDistillery = makeEntry({});
    const result = applyFilters([noDistillery], { ...DEFAULT_FILTERS, distilleries: ["Ardbeg"] });
    expect(result).toHaveLength(0);
  });
});

describe("applyFilters — fill state", () => {
  it("filters by fill state", () => {
    const sealed = makeEntry({ fillState: "sealed" });
    const open = makeEntry({ fillState: "open" });
    const finished = makeEntry({ fillState: "finished" });
    const result = applyFilters([sealed, open, finished], { ...DEFAULT_FILTERS, fillStates: ["open", "finished"] });
    expect(result).toHaveLength(2);
  });
});

describe("applyFilters — ABV buckets", () => {
  it("under-46 matches ABV below 46", () => {
    const entry = makeEntry({ abv: 43 });
    expect(applyFilters([entry], { ...DEFAULT_FILTERS, abvBuckets: ["under-46"] })).toHaveLength(1);
  });

  it("46-55 matches ABV in range", () => {
    const entry = makeEntry({ abv: 46 });
    expect(applyFilters([entry], { ...DEFAULT_FILTERS, abvBuckets: ["46-55"] })).toHaveLength(1);
    const entry2 = makeEntry({ abv: 55 });
    expect(applyFilters([entry2], { ...DEFAULT_FILTERS, abvBuckets: ["46-55"] })).toHaveLength(1);
  });

  it("55-plus matches ABV above 55", () => {
    const entry = makeEntry({ abv: 57.1 });
    expect(applyFilters([entry], { ...DEFAULT_FILTERS, abvBuckets: ["55-plus"] })).toHaveLength(1);
  });

  it("excludes entry with no ABV when bucket filter active", () => {
    const entry = makeEntry({});
    expect(applyFilters([entry], { ...DEFAULT_FILTERS, abvBuckets: ["under-46"] })).toHaveLength(0);
  });
});

describe("applyFilters — age buckets", () => {
  it("nas matches entry with 'nas' tag", () => {
    const entry = makeEntry({ tags: ["nas"] });
    expect(applyFilters([entry], { ...DEFAULT_FILTERS, ageBuckets: ["nas"] })).toHaveLength(1);
  });

  it("nas matches entry with no ageStatement", () => {
    const entry = makeEntry({});
    expect(applyFilters([entry], { ...DEFAULT_FILTERS, ageBuckets: ["nas"] })).toHaveLength(1);
  });

  it("under-12 matches ageStatement < 12", () => {
    const entry = makeEntry({ ageStatement: 10 });
    expect(applyFilters([entry], { ...DEFAULT_FILTERS, ageBuckets: ["under-12"] })).toHaveLength(1);
  });

  it("12-18 matches ageStatement 12 through 18", () => {
    const entry = makeEntry({ ageStatement: 16 });
    expect(applyFilters([entry], { ...DEFAULT_FILTERS, ageBuckets: ["12-18"] })).toHaveLength(1);
  });

  it("18-25 matches ageStatement 19 through 25", () => {
    const entry = makeEntry({ ageStatement: 21 });
    expect(applyFilters([entry], { ...DEFAULT_FILTERS, ageBuckets: ["18-25"] })).toHaveLength(1);
  });

  it("25-plus matches ageStatement above 25", () => {
    const entry = makeEntry({ ageStatement: 30 });
    expect(applyFilters([entry], { ...DEFAULT_FILTERS, ageBuckets: ["25-plus"] })).toHaveLength(1);
  });
});

describe("applyFilters — price range", () => {
  it("filters by priceMin", () => {
    const cheap = makeEntry({ purchasePrice: 400 });
    const expensive = makeEntry({ purchasePrice: 1500 });
    const result = applyFilters([cheap, expensive], { ...DEFAULT_FILTERS, priceMin: 500 });
    expect(result).toHaveLength(1);
    expect(result[0].item.purchasePrice).toBe(1500);
  });

  it("filters by priceMax", () => {
    const cheap = makeEntry({ purchasePrice: 400 });
    const expensive = makeEntry({ purchasePrice: 1500 });
    const result = applyFilters([cheap, expensive], { ...DEFAULT_FILTERS, priceMax: 1000 });
    expect(result).toHaveLength(1);
    expect(result[0].item.purchasePrice).toBe(400);
  });

  it("excludes entry with no purchasePrice when price filter active", () => {
    const entry = makeEntry({});
    expect(applyFilters([entry], { ...DEFAULT_FILTERS, priceMin: 500 })).toHaveLength(0);
  });
});

describe("applyFilters — rating and favourite", () => {
  it("filters by rating (OR within type)", () => {
    const twoStar = makeEntry({ rating: 2 });
    const threeStar = makeEntry({ rating: 3 });
    const unrated = makeEntry({});
    const result = applyFilters([twoStar, threeStar, unrated], { ...DEFAULT_FILTERS, ratings: [3] });
    expect(result).toHaveLength(1);
  });

  it("filters by favoritesOnly", () => {
    const fav = makeEntry({ isFavorite: true, rating: 3 });
    const notFav = makeEntry({ rating: 2 });
    const result = applyFilters([fav, notFav], { ...DEFAULT_FILTERS, favoritesOnly: true });
    expect(result).toHaveLength(1);
    expect(result[0].item.isFavorite).toBe(true);
  });
});

describe("filtersFromSearchParams", () => {
  function params(init: Record<string, string | string[]>): URLSearchParams {
    const p = new URLSearchParams();
    for (const [key, value] of Object.entries(init)) {
      const values = Array.isArray(value) ? value : [value];
      for (const v of values) p.append(key, v);
    }
    return p;
  }

  it("returns DEFAULT_FILTERS for empty params", () => {
    expect(filtersFromSearchParams(new URLSearchParams())).toEqual(DEFAULT_FILTERS);
  });

  it("seeds distilleries from URL", () => {
    const result = filtersFromSearchParams(params({ distillery: ["Ardbeg", "Laphroaig"] }));
    expect(result.distilleries).toEqual(["Ardbeg", "Laphroaig"]);
  });

  it("seeds ratings as numbers", () => {
    const result = filtersFromSearchParams(params({ rating: "3" }));
    expect(result.ratings).toEqual([3]);
  });

  it("seeds favoritesOnly from favorites=true", () => {
    const result = filtersFromSearchParams(params({ favorites: "true" }));
    expect(result.favoritesOnly).toBe(true);
  });

  it("seeds priceMin and priceMax as numbers", () => {
    const result = filtersFromSearchParams(params({ priceMin: "500", priceMax: "2000" }));
    expect(result.priceMin).toBe(500);
    expect(result.priceMax).toBe(2000);
  });

  it("ignores invalid rating values", () => {
    const result = filtersFromSearchParams(params({ rating: "99" }));
    expect(result.ratings).toEqual([]);
  });
});
