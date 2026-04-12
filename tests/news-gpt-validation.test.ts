import { describe, it, expect } from "vitest";
import {
  validateGptOffer,
  APPROVED_SOURCE_KEYS,
  validateAndDedupe,
  buildRetailerPrompt
} from "@/lib/news-gpt";

describe("validateGptOffer", () => {
  const validOffer = {
    source: "whiskybrother",
    kind: "special",
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

describe("validateAndDedupe", () => {
  it("passes through valid specials and new arrivals", () => {
    const result = validateAndDedupe(
      [
        {
          source: "whiskybrother",
          name: "Special Bottle",
          price: 899,
          url: "https://whiskybrother.com/products/special-bottle",
          inStock: true,
          relevanceScore: 70,
          whyItMatters: "Discounted core range bottle.",
          citations: ["https://whiskybrother.com/products/special-bottle"]
        }
      ],
      [
        {
          source: "whiskyemporium",
          name: "Fresh Arrival",
          price: 1299,
          url: "https://whiskyemporium.co.za/products/fresh-arrival",
          inStock: true,
          relevanceScore: 80,
          whyItMatters: "Brand new listing.",
          citations: ["https://whiskyemporium.co.za/products/fresh-arrival"]
        }
      ]
    );

    expect(result.rejectionCount).toBe(0);
    expect(result.specials).toHaveLength(1);
    expect(result.specials[0]?.kind).toBe("special");
    expect(result.newArrivals).toHaveLength(1);
    expect(result.newArrivals[0]?.kind).toBe("new_release");
  });

  it("counts invalid items as rejections", () => {
    const result = validateAndDedupe(
      [
        {
          source: "whiskybrother",
          name: "",
          price: 899,
          url: "https://whiskybrother.com/products/bad-special"
        }
      ],
      [
        {
          source: "whiskyemporium",
          name: "Missing Price"
        }
      ]
    );

    expect(result.rejectionCount).toBe(2);
    expect(result.specials).toHaveLength(0);
    expect(result.newArrivals).toHaveLength(0);
  });

  it("deduplicates duplicate urls across sections", () => {
    const duplicateUrl = "https://whiskybrother.com/products/shared-bottle";

    const result = validateAndDedupe(
      [
        {
          source: "whiskybrother",
          name: "Shared Bottle",
          price: 999,
          url: duplicateUrl,
          citations: [duplicateUrl]
        }
      ],
      [
        {
          source: "whiskybrother",
          name: "Shared Bottle",
          price: 999,
          url: duplicateUrl,
          citations: [duplicateUrl]
        }
      ]
    );

    expect(result.specials).toHaveLength(1);
    expect(result.newArrivals).toHaveLength(0);
    expect(result.rejectionCount).toBe(0);
  });
});

describe("buildRetailerPrompt", () => {
  it("includes the retailer domain, source key, and no-price-filter instruction", () => {
    const prompt = buildRetailerPrompt("whiskybrother");

    expect(prompt).toContain("whiskybrother.com");
    expect(prompt).toContain('Use source key: "whiskybrother"');
    expect(prompt).toContain("Include ALL items you find regardless of price");
  });
});
