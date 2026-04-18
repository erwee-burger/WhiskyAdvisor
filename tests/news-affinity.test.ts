import { describe, expect, it } from "vitest";

import { getNewsAffinity } from "@/lib/news-affinity";
import type { NewsFeedItem, PalateProfile } from "@/lib/types";

function buildItem(overrides: Partial<NewsFeedItem> = {}): NewsFeedItem {
  return {
    id: "item-1",
    source: "whiskybrother",
    kind: "special",
    name: "Sherried Single Cask Scotch",
    price: 1299,
    originalPrice: 1499,
    discountPct: 13,
    url: "https://www.whiskybrother.com/products/sample-bottle",
    inStock: true,
    relevanceScore: 80,
    budgetFit: "stretch",
    whyItMatters: "A dense dried-fruit profile with clear oloroso influence.",
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

describe("getNewsAffinity", () => {
  it("returns null when the profile has no meaningful signals", () => {
    expect(getNewsAffinity(buildItem(), buildProfile())).toBeNull();
    expect(getNewsAffinity(buildItem(), null)).toBeNull();
  });

  it("treats strong cask overlap as a strong fit", () => {
    const affinity = getNewsAffinity(
      buildItem({
        name: "Oloroso Single Cask Scotch",
        whyItMatters: "Dried fruit and oloroso depth in a notable single-cask release."
      }),
      buildProfile({
        favoredCaskStyles: ["sherry-cask"],
        favoredFlavorTags: ["raisin"],
        favoredRegions: ["Scotland"]
      })
    );

    expect(affinity).not.toBeNull();
    expect(affinity?.band).toBe("strong_fit");
    expect(affinity?.reasons).toContain("Sherry cask lane");
  });

  it("recognizes flavor-note overlap from the item text", () => {
    const affinity = getNewsAffinity(
      buildItem({
        whyItMatters: "Maritime brine and soft smoke make this one feel immediately familiar."
      }),
      buildProfile({
        favoredFlavorTags: ["brine", "smoke"]
      })
    );

    expect(affinity).not.toBeNull();
    expect(affinity?.score).toBeGreaterThanOrEqual(70);
    expect(affinity?.reasons).toEqual(expect.arrayContaining(["Maritime notes", "Smoke notes"]));
  });

  it("rewards peat alignment when the bottle reads as heavily peated", () => {
    const affinity = getNewsAffinity(
      buildItem({
        kind: "new_release",
        name: "Laphroaig Cask Strength Batch 17",
        whyItMatters: "A fresh batch with the distillery's signature smoke-first style."
      }),
      buildProfile({
        favoredPeatTag: "heavily-peated"
      })
    );

    expect(affinity).not.toBeNull();
    expect(affinity?.band).toBe("good_fit");
    expect(affinity?.reasons).toContain("Heavy peat comfort zone");
  });

  it("detects explicit region tokens when present", () => {
    const affinity = getNewsAffinity(
      buildItem({
        kind: "new_release",
        name: "Japanese Single Malt 2026 Edition",
        whyItMatters: "A fresh Japanese release with clean oak and orchard fruit."
      }),
      buildProfile({
        favoredRegions: ["Japan"]
      })
    );

    expect(affinity).not.toBeNull();
    expect(affinity?.score).toBeGreaterThan(55);
    expect(affinity?.reasons).toContain("Japan lane");
  });
});
