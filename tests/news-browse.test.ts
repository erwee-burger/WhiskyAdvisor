import { describe, expect, it } from "vitest";

import { buildNewsBrowseResult, DEFAULT_NEWS_UI_FILTERS } from "@/lib/news-browse";
import { getNewsItemVisitKey } from "@/lib/news-visit";
import type { NewsFeedItem, NewsUiFilters, PalateProfile } from "@/lib/types";

function buildItem(overrides: Partial<NewsFeedItem> = {}): NewsFeedItem {
  return {
    id: "item-1",
    source: "whiskybrother",
    kind: "special",
    name: "Sample Whisky",
    price: 999,
    originalPrice: 1199,
    discountPct: 17,
    url: `https://www.whiskybrother.com/products/${overrides.id ?? "sample-whisky"}`,
    inStock: true,
    relevanceScore: 80,
    budgetFit: "in_budget",
    whyItMatters: "A clean sherry-forward bottle.",
    citations: [],
    ...overrides
  };
}

function buildProfile(overrides: Partial<PalateProfile> = {}): PalateProfile {
  return {
    cards: [],
    favoredFlavorTags: [],
    favoredRegions: [],
    favoredCaskStyles: [],
    favoredPeatTag: null,
    ...overrides
  };
}

function browse(params?: Partial<{
  specials: NewsFeedItem[];
  newArrivals: NewsFeedItem[];
  filters: NewsUiFilters;
  profile: PalateProfile | null;
  showVisitState: boolean;
  unseenItemKeys: string[];
}>) {
  return buildNewsBrowseResult({
    specials: params?.specials ?? [],
    newArrivals: params?.newArrivals ?? [],
    filters: params?.filters ?? DEFAULT_NEWS_UI_FILTERS,
    sortOption: "recommended",
    profile: params?.profile ?? null,
    showVisitState: params?.showVisitState ?? false,
    unseenItemKeys: params?.unseenItemKeys ?? []
  });
}

describe("buildNewsBrowseResult", () => {
  it("filters by retailer source", () => {
    const result = browse({
      specials: [
        buildItem({ id: "wb", source: "whiskybrother" }),
        buildItem({ id: "ngf", source: "normangoodfellows" })
      ],
      filters: { ...DEFAULT_NEWS_UI_FILTERS, retailer: "normangoodfellows" }
    });

    expect(result.specials).toHaveLength(1);
    expect(result.specials[0]?.item.source).toBe("normangoodfellows");
  });

  it("groups over-budget and above-budget under the same budget filter", () => {
    const result = browse({
      specials: [
        buildItem({ id: "stretch", budgetFit: "stretch" }),
        buildItem({ id: "over", budgetFit: "over_budget" }),
        buildItem({ id: "above", budgetFit: "above_budget" })
      ],
      filters: { ...DEFAULT_NEWS_UI_FILTERS, budget: "over_budget_or_above" }
    });

    expect(result.specials.map((entry) => entry.item.budgetFit)).toEqual(["over_budget", "above_budget"]);
  });

  it("filters by palate fit when a meaningful profile exists", () => {
    const profile = buildProfile({
      favoredCaskStyles: ["sherry-cask"],
      favoredFlavorTags: ["raisin"],
      favoredRegions: ["Scotland"]
    });
    const result = browse({
      specials: [
        buildItem({
          id: "fit",
          name: "Oloroso Single Cask Scotch",
          whyItMatters: "Dried fruit depth and oloroso richness."
        }),
        buildItem({
          id: "neutral",
          name: "Bright Bourbon Barrel Malt",
          whyItMatters: "Vanilla and citrus in a lighter register."
        })
      ],
      filters: { ...DEFAULT_NEWS_UI_FILTERS, palateFit: "strong_fit" },
      profile
    });

    expect(result.showPalateFit).toBe(true);
    expect(result.specials).toHaveLength(1);
    expect(result.specials[0]?.item.id).toBe("fit");
  });

  it("filters by owner freshness state", () => {
    const seen = buildItem({ id: "seen" });
    const fresh = buildItem({ id: "fresh", url: "https://www.whiskybrother.com/products/fresh" });
    const result = browse({
      specials: [seen, fresh],
      filters: { ...DEFAULT_NEWS_UI_FILTERS, freshness: "new_to_you" },
      showVisitState: true,
      unseenItemKeys: [getNewsItemVisitKey(fresh)]
    });

    expect(result.specials).toHaveLength(1);
    expect(result.specials[0]?.item.id).toBe("fresh");
  });

  it("ands retailer, budget, and palate filters together", () => {
    const profile = buildProfile({
      favoredCaskStyles: ["sherry-cask"],
      favoredFlavorTags: ["raisin"],
      favoredRegions: ["Scotland"]
    });
    const result = browse({
      specials: [
        buildItem({
          id: "match",
          source: "normangoodfellows",
          budgetFit: "stretch",
          name: "Oloroso Single Cask Scotch",
          whyItMatters: "Dried fruit depth and oloroso richness."
        }),
        buildItem({
          id: "wrong-budget",
          source: "normangoodfellows",
          budgetFit: "in_budget",
          name: "Oloroso Single Cask Scotch",
          whyItMatters: "Dried fruit depth and oloroso richness."
        }),
        buildItem({
          id: "wrong-retailer",
          source: "whiskybrother",
          budgetFit: "stretch",
          name: "Oloroso Single Cask Scotch",
          whyItMatters: "Dried fruit depth and oloroso richness."
        })
      ],
      filters: {
        retailer: "normangoodfellows",
        budget: "stretch",
        palateFit: "strong_fit",
        freshness: "all"
      },
      profile
    });

    expect(result.specials).toHaveLength(1);
    expect(result.specials[0]?.item.id).toBe("match");
  });

  it("pins unseen specials first, then prefers fit over discount", () => {
    const profile = buildProfile({
      favoredCaskStyles: ["sherry-cask"],
      favoredFlavorTags: ["raisin"],
      favoredRegions: ["Scotland"]
    });
    const fresh = buildItem({ id: "fresh", discountPct: 5, originalPrice: 1100, url: "https://www.whiskybrother.com/products/fresh" });
    const strongFit = buildItem({
      id: "strong-fit",
      discountPct: 5,
      originalPrice: 1100,
      name: "Oloroso Single Cask Scotch",
      whyItMatters: "Dried fruit depth and oloroso richness."
    });
    const bigDiscount = buildItem({
      id: "big-discount",
      discountPct: 30,
      originalPrice: 1400,
      name: "Bright Bourbon Barrel Malt",
      whyItMatters: "Vanilla and citrus in a lighter register."
    });

    const result = browse({
      specials: [bigDiscount, strongFit, fresh],
      profile,
      showVisitState: true,
      unseenItemKeys: [getNewsItemVisitKey(fresh)]
    });

    expect(result.specials.map((entry) => entry.item.id)).toEqual(["fresh", "strong-fit", "big-discount"]);
  });

  it("sorts new arrivals by freshness, then fit, then relevance", () => {
    const profile = buildProfile({
      favoredPeatTag: "heavily-peated"
    });
    const fresh = buildItem({
      id: "fresh-arrival",
      kind: "new_release",
      url: "https://www.whiskybrother.com/products/fresh-arrival",
      relevanceScore: 40
    });
    const strongFit = buildItem({
      id: "fit-arrival",
      kind: "new_release",
      name: "Laphroaig Cask Strength Batch 17",
      whyItMatters: "Smoke-first distillery style in a fresh batch.",
      relevanceScore: 60
    });
    const higherRelevance = buildItem({
      id: "high-relevance",
      kind: "new_release",
      name: "Rare Limited Edition Malt",
      whyItMatters: "Interesting but outside the usual smoky lane.",
      relevanceScore: 92
    });

    const result = browse({
      newArrivals: [higherRelevance, strongFit, fresh],
      profile,
      showVisitState: true,
      unseenItemKeys: [getNewsItemVisitKey(fresh)]
    });

    expect(result.newArrivals.map((entry) => entry.item.id)).toEqual(["fresh-arrival", "fit-arrival", "high-relevance"]);
  });

  it("derives retailer options from the live items", () => {
    const result = browse({
      specials: [
        buildItem({ id: "emporium", source: "whiskyemporium" }),
        buildItem({ id: "rare", source: "rarefinds" })
      ]
    });

    expect(result.retailers).toEqual(expect.arrayContaining(["whiskyemporium", "rarefinds"]));
  });
});
