import { describe, expect, it } from "vitest";

import { getNewsItemVisitKey, reconcileSeenNewsItems } from "@/lib/news-visit";
import type { NewsFeedItem } from "@/lib/types";

function buildItem(overrides: Partial<NewsFeedItem> = {}): NewsFeedItem {
  return {
    id: "item-1",
    source: "whiskybrother",
    kind: "special",
    name: "GlenDronach 12 Year Old",
    price: 649,
    url: "https://www.whiskybrother.com/products/glendronach-12-year-old?ref=feed",
    inStock: true,
    relevanceScore: 88,
    budgetFit: "in_budget",
    whyItMatters: null,
    citations: [],
    ...overrides
  };
}

describe("news visit tracking", () => {
  it("uses a stable key across refresh-specific row ids and url params", () => {
    const first = buildItem();
    const second = buildItem({
      id: "item-99",
      url: "https://www.whiskybrother.com/products/glendronach-12-year-old?utm_source=refresh#top"
    });

    expect(getNewsItemVisitKey(first)).toBe(getNewsItemVisitKey(second));
  });

  it("treats the first visit as a baseline instead of flagging everything as new", () => {
    const items = [
      buildItem(),
      buildItem({
        id: "item-2",
        kind: "new_release",
        name: "Springbank 15 Year Old",
        url: "https://www.whiskybrother.com/products/springbank-15-year-old"
      })
    ];

    const result = reconcileSeenNewsItems(items, null);

    expect(result.hadBaseline).toBe(false);
    expect(result.unseenKeys).toEqual([]);
    expect(result.seenKeys).toHaveLength(2);
  });

  it("flags only unseen items after a baseline exists", () => {
    const existing = buildItem();
    const newArrival = buildItem({
      id: "item-3",
      kind: "new_release",
      name: "Bunnahabhain 12 Year Old",
      url: "https://www.whiskybrother.com/products/bunnahabhain-12-year-old"
    });

    const result = reconcileSeenNewsItems(
      [existing, newArrival],
      [getNewsItemVisitKey(existing)]
    );

    expect(result.hadBaseline).toBe(true);
    expect(result.unseenKeys).toEqual([getNewsItemVisitKey(newArrival)]);
    expect(result.seenKeys).toEqual(
      expect.arrayContaining([
        getNewsItemVisitKey(existing),
        getNewsItemVisitKey(newArrival)
      ])
    );
  });

  it("treats the same bottle in different sections as distinct visit states", () => {
    const special = buildItem({
      kind: "special",
      url: "https://www.whiskybrother.com/products/talisker-18-year-old"
    });
    const release = buildItem({
      kind: "new_release",
      url: "https://www.whiskybrother.com/products/talisker-18-year-old"
    });

    expect(getNewsItemVisitKey(special)).not.toBe(getNewsItemVisitKey(release));
  });
});
