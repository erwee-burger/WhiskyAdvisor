import { describe, expect, it } from "vitest";

import { buildCollectionAnalytics } from "@/lib/analytics";
import type { CollectionViewItem, ExpressionFlavorProfile, FlavorPillar } from "@/lib/types";

function buildFlavorProfile(
  expressionId: string,
  pillars: Partial<Record<FlavorPillar, number>>,
  topNotes: string[]
): ExpressionFlavorProfile {
  return {
    id: `fp_${expressionId}`,
    expressionId,
    pillars: {
      smoky: 0,
      sweet: 0,
      spicy: 0,
      fruity: 0,
      oaky: 0,
      floral: 0,
      malty: 0,
      coastal: 0,
      ...pillars
    },
    topNotes,
    confidence: 0.72,
    evidenceCount: topNotes.length,
    explanation: "Weighted from tasting notes and structural traits.",
    scoringVersion: "v2",
    modelVersion: "deterministic-v2",
    generatedAt: "2026-04-18T09:00:00.000Z",
    createdAt: "2026-04-18T09:00:00.000Z",
    updatedAt: "2026-04-18T09:00:00.000Z"
  };
}

function buildItem(overrides: Partial<CollectionViewItem> = {}): CollectionViewItem {
  const base: CollectionViewItem = {
    item: {
      id: "item_1",
      expressionId: "expr_1",
      status: "owned",
      fillState: "sealed",
      purchasePrice: 1200,
      purchaseCurrency: "ZAR",
      rating: 3,
      isFavorite: true,
      createdAt: "2026-04-18T09:00:00.000Z",
      updatedAt: "2026-04-18T09:00:00.000Z"
    },
    expression: {
      id: "expr_1",
      name: "Test Whisky",
      distilleryName: "Distillery A",
      bottlerName: "Bottler A",
      brand: "Brand A",
      country: "Scotland",
      abv: 46,
      tags: ["single-malt", "sherry-cask", "independent-bottler", "heavily-peated"],
      tastingNotes: ["peat smoke", "raisin", "brine"]
    },
    flavorProfile: buildFlavorProfile("expr_1", { smoky: 8, fruity: 6, coastal: 5 }, ["peat smoke", "sea salt", "raisin"]),
    images: []
  };

  return {
    ...base,
    ...overrides,
    item: {
      ...base.item,
      ...overrides.item
    },
    expression: {
      ...base.expression,
      ...overrides.expression
    }
  };
}

describe("buildCollectionAnalytics", () => {
  it("rolls up flavor pillars and recurring notes from saved flavor profiles", () => {
    const items = [
      buildItem(),
      buildItem({
        item: { id: "item_2", expressionId: "expr_2", purchasePrice: 1500, rating: 2, isFavorite: false },
        expression: {
          id: "expr_2",
          name: "Second Whisky",
          distilleryName: "Distillery B",
          bottlerName: "Bottler B",
          brand: "Brand B",
          tags: ["single-malt", "bourbon-cask", "peated"],
          tastingNotes: ["lemon", "vanilla"]
        },
        flavorProfile: buildFlavorProfile("expr_2", { smoky: 6, fruity: 4, sweet: 5, coastal: 2 }, ["peat smoke", "vanilla", "lemon"])
      })
    ];

    const analytics = buildCollectionAnalytics(items);

    expect(analytics.tasteIdentity.profileCoverage.profiledOwnedCount).toBe(2);
    expect(analytics.tasteIdentity.strongestPillars[0]?.pillar).toBe("smoky");
    expect(analytics.tasteIdentity.topNotes[0]).toEqual({ note: "peat smoke", count: 2 });
    expect(analytics.tasteIdentity.pillarAverages.smoky).toBe(7);
  });

  it("computes cask, rating, and spend insights", () => {
    const items = [
      buildItem(),
      buildItem({
        item: { id: "item_2", expressionId: "expr_2", purchasePrice: 2000, rating: 2, isFavorite: false },
        expression: {
          id: "expr_2",
          name: "Bourbon Cask Dram",
          distilleryName: "Distillery B",
          bottlerName: "Official Distillery",
          brand: "Brand B",
          tags: ["single-malt", "bourbon-cask"],
          tastingNotes: ["vanilla"]
        },
        flavorProfile: buildFlavorProfile("expr_2", { sweet: 5, oaky: 4 }, ["vanilla"])
      }),
      buildItem({
        item: { id: "item_3", expressionId: "expr_3", purchasePrice: undefined, rating: undefined, isFavorite: false },
        expression: {
          id: "expr_3",
          name: "Wishlist Bottle",
          distilleryName: "Distillery C",
          bottlerName: "Official Distillery",
          brand: "Brand C",
          country: "Ireland",
          tags: ["single-malt", "wine-cask"],
          tastingNotes: []
        },
        flavorProfile: undefined
      })
    ];

    const analytics = buildCollectionAnalytics(items);

    expect(analytics.collectionShape.caskStyles[0]?.tag).toBe("sherry-cask");
    expect(analytics.collectionShape.independentVsOfficial.independent).toBe(1);
    expect(analytics.ratingsInsight.ratedCount).toBe(2);
    expect(analytics.ratingsInsight.averageRating).toBe(2.5);
    expect(analytics.spendInsight.paidTotalZar).toBe(3200);
    expect(analytics.spendInsight.medianOwnedBottlePriceZar).toBe(1600);
  });

  it("produces deterministic blind-spot prompts from collection imbalance", () => {
    const items = [
      buildItem(),
      buildItem({
        item: { id: "item_2", expressionId: "expr_2", purchasePrice: 1500 },
        expression: {
          id: "expr_2",
          name: "Smoky Dram 2",
          distilleryName: "Distillery A",
          bottlerName: "Bottler B",
          tags: ["single-malt", "sherry-cask", "independent-bottler", "heavily-peated"],
          tastingNotes: ["peat smoke", "ash", "raisin"]
        },
        flavorProfile: buildFlavorProfile("expr_2", { smoky: 8, fruity: 6, floral: 1 }, ["peat smoke", "ash", "raisin"])
      }),
      buildItem({
        item: { id: "item_3", expressionId: "expr_3", purchasePrice: 1700, rating: 3, isFavorite: true },
        expression: {
          id: "expr_3",
          name: "Smoky Dram 3",
          distilleryName: "Distillery B",
          bottlerName: "Bottler C",
          tags: ["single-malt", "independent-bottler", "heavily-peated"],
          tastingNotes: ["peat smoke", "tar"]
        },
        flavorProfile: buildFlavorProfile("expr_3", { smoky: 9, floral: 1 }, ["peat smoke", "tar"])
      })
    ];

    const analytics = buildCollectionAnalytics(items);

    expect(analytics.blindSpots.length).toBeGreaterThan(0);
    expect(analytics.blindSpots.some((entry) => entry.title.includes("Smoke dominates"))).toBe(true);
  });

  it("handles sparse flavor-profile coverage gracefully", () => {
    const items = [
      buildItem({ flavorProfile: undefined }),
      buildItem({
        item: { id: "item_2", expressionId: "expr_2", rating: undefined, isFavorite: false },
        expression: {
          id: "expr_2",
          name: "Second Bottle",
          distilleryName: "Distillery B",
          bottlerName: "Bottler B",
          tags: ["single-malt", "bourbon-cask"],
          tastingNotes: []
        },
        flavorProfile: undefined
      }),
      buildItem({
        item: { id: "item_3", expressionId: "expr_3", rating: undefined, isFavorite: false },
        expression: {
          id: "expr_3",
          name: "Third Bottle",
          distilleryName: "Distillery C",
          bottlerName: "Bottler C",
          tags: ["single-malt"],
          tastingNotes: []
        },
        flavorProfile: undefined
      })
    ];

    const analytics = buildCollectionAnalytics(items);

    expect(analytics.tasteIdentity.profileCoverage.profiledOwnedCount).toBe(0);
    expect(analytics.tasteIdentity.topNotes).toEqual([]);
    expect(analytics.blindSpots.some((entry) => entry.title.includes("Flavor coverage"))).toBe(true);
  });

  it("excludes missing region, distillery, and bottler values from split and concentration rollups", () => {
    const items = [
      buildItem({
        expression: {
          country: "Scotland",
          distilleryName: "Distillery A",
          bottlerName: "Bottler A"
        }
      }),
      buildItem({
        item: { id: "item_2", expressionId: "expr_2" },
        expression: {
          id: "expr_2",
          name: "Bottle Without Metadata",
          country: undefined,
          distilleryName: undefined,
          bottlerName: undefined,
          tags: ["single-malt"],
          tastingNotes: []
        },
        flavorProfile: undefined
      })
    ];

    const analytics = buildCollectionAnalytics(items);

    expect(analytics.regionSplit).toEqual([{ region: "Scotland", count: 1 }]);
    expect(analytics.topDistilleries).toEqual([{ name: "Distillery A", count: 1 }]);
    expect(analytics.topBottlers).toEqual([{ name: "Bottler A", count: 1 }]);
    expect(analytics.collectionShape.topRegionShare).toBe(100);
    expect(analytics.collectionShape.topDistilleryShare).toBe(100);
  });
});
