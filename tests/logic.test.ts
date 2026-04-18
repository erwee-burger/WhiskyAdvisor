import { describe, expect, it } from "vitest";

import { buildBuyNextSuggestions, buildDrinkNowSuggestions } from "@/lib/advisor";
import { buildCollectionAnalytics } from "@/lib/analytics";
import { buildComparison } from "@/lib/comparison";
import { buildPalateProfile } from "@/lib/profile";
import { seedStore } from "@/lib/seed-data";
import type { CollectionViewItem } from "@/lib/types";

function buildView(): CollectionViewItem[] {
  return seedStore.collectionItems.map((item) => {
    const expression = seedStore.expressions.find((entry) => entry.id === item.expressionId)!;
    const tastingEntries = seedStore.tastingEntries
      .filter((entry) => entry.collectionItemId === item.id)
      .sort((left, right) => new Date(right.tastedAt).getTime() - new Date(left.tastedAt).getTime());

    return {
      item,
      expression,
      tastingEntries,
      latestTasting: tastingEntries[0],
      images: seedStore.itemImages.filter((entry) => entry.collectionItemId === item.id)
    };
  });
}

describe("whisky domain logic", () => {
  it("builds analytics from collection data", () => {
    const analytics = buildCollectionAnalytics(buildView());

    expect(analytics.totals.owned).toBe(3);
    expect(analytics.totals.wishlist).toBe(1);
    expect(analytics.topDistilleries[0]?.name).toBe("Lagavulin");
  });

  it("builds a visible palate profile", () => {
    const profile = buildPalateProfile(buildView().filter((entry) => entry.item.status === "owned"));

    expect(profile.cards.length).toBeGreaterThan(0);
    expect(profile.favoredRegions.length).toBeGreaterThan(0);
  });

  it("creates drink-now and buy-next suggestions", () => {
    const view = buildView();
    const profile = buildPalateProfile(view.filter((entry) => entry.item.status === "owned"));

    const drinkNow = buildDrinkNowSuggestions(view, profile);
    const buyNext = buildBuyNextSuggestions(view, profile);

    expect(drinkNow.length).toBeGreaterThan(0);
    expect(buyNext.length).toBeGreaterThan(0);
  });

  it("builds a structured comparison", () => {
    const view = buildView();
    const comparison = buildComparison(view[0], view[1]);

    expect(comparison.rows.length).toBeGreaterThan(5);
    expect(comparison.summary.length).toBeGreaterThan(10);
  });
});

describe("extractBottleSuggestions", async () => {
  const { extractBottleSuggestions } = await import("@/components/tasting-chat");

  it("returns empty array when no JSON block", () => {
    const result = extractBottleSuggestions("Here are some bottles for you.");
    expect(result.bottles).toEqual([]);
    expect(result.text).toBe("Here are some bottles for you.");
  });

  it("parses bottle suggestions from JSON block", () => {
    const content = 'Try these:\n{"bottleSuggestions":[{"id":"abc","name":"Ardbeg 10"}]}';
    const result = extractBottleSuggestions(content);
    expect(result.bottles).toEqual([{ id: "abc", name: "Ardbeg 10" }]);
    expect(result.text).toBe("Try these:");
  });

  it("leaves text intact when JSON block is malformed", () => {
    const content = 'text {"bottleSuggestions": bad json}';
    const result = extractBottleSuggestions(content);
    expect(result.bottles).toEqual([]);
    expect(result.text).toBe(content);
  });
});
