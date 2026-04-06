import { describe, it, expect } from "vitest";
import type { NewsItem, ScoredNewsItem } from "@/lib/types";

describe("NewsItem type", () => {
  it("accepts a valid special", () => {
    const item: NewsItem = {
      source: "whiskybrother",
      kind: "special",
      name: "Glenfarclas 15",
      price: 1299,
      originalPrice: 1599,
      discountPct: 19,
      url: "https://whiskybrother.com/glenfarclas-15",
      inStock: true
    };
    expect(item.kind).toBe("special");
  });

  it("accepts a valid new release", () => {
    const item: NewsItem = {
      source: "normangoodfellows",
      kind: "new_release",
      name: "Springbank 12 CS",
      price: 2100,
      url: "https://ngf.co.za/springbank-12-cs",
      inStock: true
    };
    expect(item.kind).toBe("new_release");
  });

  it("accepts a ScoredNewsItem with palate score", () => {
    const item: ScoredNewsItem = {
      id: "abc",
      source: "whiskyemporium",
      kind: "special",
      name: "Lagavulin 16",
      price: 1800,
      url: "https://whiskyemporium.co.za/lagavulin-16",
      inStock: true,
      fetchedAt: "2026-04-06T07:00:00Z",
      palateScore: 82,
      palateStars: 2
    };
    expect(item.palateStars).toBe(2);
  });
});
