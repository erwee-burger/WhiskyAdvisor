import { describe, it, expect, vi } from "vitest";
import { runAllScrapers } from "@/lib/scrapers/index";
import type { NewsItem } from "@/lib/types";

describe("runAllScrapers", () => {
  it("collects results from all scrapers", async () => {
    const mockItem: NewsItem = {
      source: "test",
      kind: "special",
      name: "Test Whisky",
      price: 999,
      url: "https://test.com/whisky",
      inStock: true
    };

    const scrapers = [
      vi.fn().mockResolvedValue([mockItem]),
      vi.fn().mockResolvedValue([mockItem]),
    ];

    const results = await runAllScrapers(scrapers);
    expect(results).toHaveLength(2);
  });

  it("continues if one scraper fails", async () => {
    const mockItem: NewsItem = {
      source: "test",
      kind: "new_release",
      name: "Another Whisky",
      price: 1500,
      url: "https://test.com/another",
      inStock: true
    };

    const scrapers = [
      vi.fn().mockRejectedValue(new Error("network error")),
      vi.fn().mockResolvedValue([mockItem]),
    ];

    const results = await runAllScrapers(scrapers);
    expect(results).toHaveLength(1);
  });

  it("returns empty array if all scrapers fail", async () => {
    const scrapers = [
      vi.fn().mockRejectedValue(new Error("fail")),
      vi.fn().mockRejectedValue(new Error("fail")),
    ];

    const results = await runAllScrapers(scrapers);
    expect(results).toHaveLength(0);
  });
});
