// tests/news-gpt-validation.test.ts
import { describe, it, expect } from "vitest";
import { validateGptOffer, APPROVED_SOURCE_KEYS } from "@/lib/news-gpt";

describe("validateGptOffer", () => {
  const validOffer = {
    source: "whiskybrother",
    name: "Glenfarclas 12",
    price: 799,
    url: "https://whiskybrother.com/products/glenfarclas-12",
    inStock: true,
    relevanceScore: 75,
    whyItMatters: "Good value sherry cask.",
    citations: ["https://whiskybrother.com/products/glenfarclas-12"]
  };

  it("accepts a valid offer", () => {
    expect(() => validateGptOffer(validOffer)).not.toThrow();
  });

  it("rejects non-approved source domain", () => {
    expect(() => validateGptOffer({ ...validOffer, source: "totalwine" })).toThrow(
      /source/
    );
  });

  it("rejects missing price", () => {
    const { price: _p, ...noPrice } = validOffer;
    expect(() => validateGptOffer(noPrice)).toThrow(/price/);
  });

  it("rejects zero or negative price", () => {
    expect(() => validateGptOffer({ ...validOffer, price: 0 })).toThrow(/price/);
    expect(() => validateGptOffer({ ...validOffer, price: -5 })).toThrow(/price/);
  });

  it("rejects URL that does not belong to the declared source domain", () => {
    expect(() =>
      validateGptOffer({ ...validOffer, url: "https://totalwine.com/some-bottle" })
    ).toThrow(/url/);
  });

  it("rejects missing name", () => {
    expect(() => validateGptOffer({ ...validOffer, name: "" })).toThrow(/name/);
    expect(() => validateGptOffer({ ...validOffer, name: undefined })).toThrow(/name/);
  });

  it("rejects non-product URL (no path beyond domain root)", () => {
    expect(() =>
      validateGptOffer({ ...validOffer, url: "https://whiskybrother.com" })
    ).toThrow(/url/);
    expect(() =>
      validateGptOffer({ ...validOffer, url: "https://whiskybrother.com/" })
    ).toThrow(/url/);
  });

  it("APPROVED_SOURCE_KEYS contains exactly the 5 approved retailers", () => {
    expect(APPROVED_SOURCE_KEYS).toEqual(
      expect.arrayContaining([
        "whiskybrother",
        "bottegawhiskey",
        "mothercityliquor",
        "whiskyemporium",
        "normangoodfellows"
      ])
    );
    expect(APPROVED_SOURCE_KEYS).toHaveLength(5);
  });
});
