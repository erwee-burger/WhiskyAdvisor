import { describe, it, expect } from "vitest";
import { detectContextTriggers, buildCollectionSummary } from "@/lib/advisor-context";
import type { CollectionViewItem } from "@/lib/types";

describe("detectContextTriggers", () => {
  it("detects drink-now triggers", () => {
    const result = detectContextTriggers("what should I open tonight?");
    expect(result.drinkNow).toBe(true);
  });

  it("detects wishlist triggers", () => {
    const result = detectContextTriggers("what should I buy next");
    expect(result.wishlist).toBe(true);
  });

  it("detects analytics triggers", () => {
    const result = detectContextTriggers("how many bottles do I have");
    expect(result.analytics).toBe(true);
  });

  it("detects tasting triggers", () => {
    const result = detectContextTriggers("show me my tasting notes");
    expect(result.tastings).toBe(true);
  });

  it("detects bottle name triggers", () => {
    const result = detectContextTriggers("tell me about my Springbank 15");
    expect(result.bottleName).toBe("springbank 15");
  });

  it("detects deals triggers", () => {
    const result = detectContextTriggers("anything on special right now");
    expect(result.deals).toBe(true);
  });

  it("detects social planning triggers", () => {
    const result = detectContextTriggers("what should I take to whisky Friday");
    expect(result.socialPlanning).toBe(true);
  });

  it("returns all false for generic query", () => {
    const result = detectContextTriggers("hello");
    expect(result.drinkNow).toBe(false);
    expect(result.wishlist).toBe(false);
    expect(result.analytics).toBe(false);
    expect(result.tastings).toBe(false);
    expect(result.socialPlanning).toBe(false);
    expect(result.deals).toBe(false);
    expect(result.bottleName).toBeNull();
  });
});

describe("buildCollectionSummary", () => {
  it("returns summary string with counts", () => {
    const items: CollectionViewItem[] = [
      {
        item: { id: "1", expressionId: "e1", status: "owned", fillState: "open", purchaseCurrency: "ZAR", createdAt: "", updatedAt: "" },
        expression: { id: "e1", name: "Springbank 15", distilleryName: "Springbank", country: "Scotland", tags: [] },
        tastingEntries: [],
        images: []
      }
    ];
    const summary = buildCollectionSummary(items);
    expect(summary).toContain("1 owned");
    expect(summary).toContain("Scotland");
  });
});
