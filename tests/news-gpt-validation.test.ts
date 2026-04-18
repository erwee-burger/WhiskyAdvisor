import { describe, it, expect } from "vitest";
import {
  validateGptOffer,
  APPROVED_SOURCE_KEYS,
  validateAndDedupe,
  buildRetailerPrompt,
  enforceRetailerOfferRules,
  isApprovedOfferUrl,
  canonicalizeRetailerProductUrl,
  parseWhiskyBrotherCollectionHtml,
  parseBottegaCollectionHtml,
  parseWhiskyEmporiumCollectionHtml,
  parseMotherCityCollectionHtml
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

  it("accepts Norman Goodfellows product urls with or without www", () => {
    expect(isApprovedOfferUrl("normangoodfellows", "https://www.ngf.co.za/product/sample-bottle/")).toBe(true);
    expect(isApprovedOfferUrl("normangoodfellows", "https://ngf.co.za/product/sample-bottle/")).toBe(true);
  });
});

describe("retailer url helpers", () => {
  it("canonicalizes Shopify collection product urls to direct product urls", () => {
    expect(
      canonicalizeRetailerProductUrl(
        "https://www.whiskybrother.com/collections/new-whisky-arrivals/products/sample-bottle?variant=1"
      )
    ).toBe("https://www.whiskybrother.com/products/sample-bottle");
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
          source: "mothercityliquor",
          name: "Fresh Arrival",
          price: 1299,
          url: "https://mothercityliquor.co.za/products/fresh-arrival",
          inStock: true,
          relevanceScore: 80,
          whyItMatters: "Brand new listing.",
          citations: ["https://mothercityliquor.co.za/products/fresh-arrival"]
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
          source: "mothercityliquor",
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

  it("pins Whisky Brother to the correct specials and new-arrivals pages with in-stock rules", () => {
    const prompt = buildRetailerPrompt("whiskybrother");

    expect(prompt).toContain("https://www.whiskybrother.com/collections/whisky-specials");
    expect(prompt).toContain("https://www.whiskybrother.com/collections/new-whisky-arrivals");
    expect(prompt).toContain("Do not include sold-out items from either Whisky Brother page.");
    expect(prompt).toContain("return the first 10 in-stock whiskies");
    expect(prompt).toContain("continue until you have 10 in-stock items if at least 10 exist");
  });

  it("pins Bottega to the correct category pages and whisky-only rules", () => {
    const prompt = buildRetailerPrompt("bottegawhiskey");

    expect(prompt).toContain("https://bottegawhiskey.com/product-category/specials-sale/?orderby=date");
    expect(prompt).toContain("https://bottegawhiskey.com/product-category/new-arrival/?orderby=date");
    expect(prompt).toContain("Include whiskies or whiskeys only");
    expect(prompt).toContain("Do not include sold-out items from either Bottega page.");
    expect(prompt).toContain("return the first 10 in-stock whiskies");
  });

  it("pins Mother City to the correct sale and new-arrivals pages with whisky-only sale rules", () => {
    const prompt = buildRetailerPrompt("mothercityliquor");

    expect(prompt).toContain("https://mothercityliquor.co.za/collections/sale?sort_by=created-descending");
    expect(prompt).toContain("https://mothercityliquor.co.za/collections/new-whisky-arrivals?sort_by=created-descending");
    expect(prompt).toContain("The Mother City sale page can be mixed with other spirits.");
    expect(prompt).toContain("Include whiskies or whiskeys only");
  });

  it("pins Whisky Emporium to the provided new-arrivals page and disables specials", () => {
    const prompt = buildRetailerPrompt("whiskyemporium");

    expect(prompt).toContain("https://whiskyemporium.co.za/shop-premium-whiskeys/?orderby=date");
    expect(prompt).toContain("Always return specials: [] for source key whiskyemporium.");
    expect(prompt).toContain("return the first 10 in-stock whiskies from that page");
  });

  it("pins Norman Goodfellows to promotions and no new-arrivals output", () => {
    const prompt = buildRetailerPrompt("normangoodfellows");

    expect(prompt).toContain("https://www.ngf.co.za/promotions/");
    expect(prompt).toContain("Norman Goodfellows does not have a dedicated new arrivals page.");
    expect(prompt).toContain("Always return newArrivals: [] for source key normangoodfellows.");
  });
});

describe("direct retailer parsers", () => {
  it("parses Whisky Brother collection items and canonicalizes product urls", () => {
    const html = `
      <div class="grid-item grid-product">
        <a class="grid-item__link" href="/collections/new-whisky-arrivals/products/sample-bottle"></a>
        <img data-src="//www.whiskybrother.com/cdn/shop/files/sample_{width}x.jpg?v=1">
        <div class="grid-product__title">Sample Bottle</div>
        <span class="grid-product__price--current"><span class="visually-hidden">R 1,490.00</span></span>
        <span class="grid-product__price--original"><span class="visually-hidden">R 1,690.00</span></span>
      </div>
    `;

    const result = parseWhiskyBrotherCollectionHtml(
      html,
      "https://www.whiskybrother.com/collections/new-whisky-arrivals",
      "new_release"
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.url).toBe("https://www.whiskybrother.com/products/sample-bottle");
    expect(result[0]?.price).toBe(1490);
    expect(result[0]?.originalPrice).toBe(1690);
    expect(result[0]?.inStock).toBe(true);
  });

  it("parses Bottega mixed category pages and keeps whisky items only", () => {
    const html = `
      <ul class="products">
        <li class="product instock product_cat-scottish-whisky product_cat-new-arrival">
          <a class="woocommerce-LoopProduct-link" href="https://bottegawhiskey.com/product/ardbeg-uigeadail/">
            <img src="https://bottegawhiskey.com/ardbeg.jpg">
            <h2 class="woocommerce-loop-product__title">Ardbeg Uigeadail</h2>
            <span class="price"><span class="woocommerce-Price-amount amount">R1,399.00</span></span>
          </a>
        </li>
        <li class="product instock product_cat-cognac product_cat-new-arrival">
          <a class="woocommerce-LoopProduct-link" href="https://bottegawhiskey.com/product/beau-geste-cognac/">
            <img src="https://bottegawhiskey.com/cognac.jpg">
            <h2 class="woocommerce-loop-product__title">Beau Geste Cognac</h2>
            <span class="price"><span class="woocommerce-Price-amount amount">R6,790.00</span></span>
          </a>
        </li>
      </ul>
    `;

    const result = parseBottegaCollectionHtml(
      html,
      "https://bottegawhiskey.com/product-category/new-arrival/?orderby=date",
      "new_release"
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Ardbeg Uigeadail");
  });

  it("parses Mother City sale pages and filters non-whisky items using Shopify meta types", () => {
    const html = `
      <script>
        var meta = {"products":[
          {"handle":"glengoyne-15-year-old","type":"Whisky"},
          {"handle":"piper-heidsieck-cuvee-brut","type":"Champagne & Sparkling"}
        ],"page":{"pageType":"collection"}};
      </script>
      <div class="productitem">
        <a class="productitem--image-link" href="/collections/sale/products/glengoyne-15-year-old"></a>
        <img class="productitem--image-primary" src="//mothercityliquor.co.za/glengoyne.jpg">
        <div class="productitem--title"><a>Glengoyne 15 Year Old</a></div>
        <div class="price__current"><span class="money">R1,349.99</span></div>
        <div class="price__compare-at"><span class="money">R1,649.99</span></div>
      </div>
      <div class="productitem">
        <a class="productitem--image-link" href="/collections/sale/products/piper-heidsieck-cuvee-brut"></a>
        <img class="productitem--image-primary" src="//mothercityliquor.co.za/piper.jpg">
        <div class="productitem--title"><a>Piper-Heidsieck Cuvee Brut</a></div>
        <div class="price__current"><span class="money">R899.99</span></div>
      </div>
    `;

    const result = parseMotherCityCollectionHtml(
      html,
      "https://mothercityliquor.co.za/collections/sale?sort_by=created-descending",
      "special"
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Glengoyne 15 Year Old");
    expect(result[0]?.url).toBe("https://mothercityliquor.co.za/products/glengoyne-15-year-old");
  });

  it("parses Whisky Emporium premium whiskies as WooCommerce new arrivals", () => {
    const html = `
      <ul class="products">
        <li class="product instock product_cat-whisky">
          <a class="woocommerce-LoopProduct-link" href="https://whiskyemporium.co.za/product/the-whistler-triple-oak/">
            <img src="https://whiskyemporium.co.za/wp-content/uploads/2026/03/the-whistler-triple-oak-300x300.webp">
            <h2 class="woocommerce-loop-product__title">The Whistler Triple Oak</h2>
            <span class="price"><span class="woocommerce-Price-amount amount">R399.99</span></span>
          </a>
        </li>
      </ul>
    `;

    const result = parseWhiskyEmporiumCollectionHtml(
      html,
      "https://whiskyemporium.co.za/shop-premium-whiskeys/?orderby=date",
      "new_release"
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.source).toBe("whiskyemporium");
    expect(result[0]?.name).toBe("The Whistler Triple Oak");
    expect(result[0]?.price).toBeCloseTo(399.99, 2);
    expect(result[0]?.url).toBe("https://whiskyemporium.co.za/product/the-whistler-triple-oak/");
  });
});

describe("enforceRetailerOfferRules", () => {
  it("removes sold-out Whisky Brother items", () => {
    const result = enforceRetailerOfferRules(
      [
        {
          source: "whiskybrother",
          kind: "special",
          name: "WB Sold Out Special",
          price: 900,
          url: "https://whiskybrother.com/products/wb-sold-out-special",
          inStock: false,
          relevanceScore: 60,
          whyItMatters: "",
          citations: []
        },
        {
          source: "mothercityliquor",
          kind: "special",
          name: "Other Retailer Special",
          price: 850,
          url: "https://mothercityliquor.co.za/products/other-special",
          inStock: false,
          relevanceScore: 60,
          whyItMatters: "",
          citations: []
        }
      ],
      [
        {
          source: "whiskybrother",
          kind: "new_release",
          name: "WB Sold Out Arrival",
          price: 1200,
          url: "https://whiskybrother.com/products/wb-sold-out-arrival",
          inStock: false,
          relevanceScore: 60,
          whyItMatters: "",
          citations: []
        }
      ]
    );

    expect(result.specials).toHaveLength(1);
    expect(result.specials[0]?.source).toBe("mothercityliquor");
    expect(result.newArrivals).toHaveLength(0);
  });

  it("caps Whisky Brother new arrivals at the first 10 in-stock items", () => {
    const newArrivals = Array.from({ length: 12 }, (_, index) => ({
      source: "whiskybrother" as const,
      kind: "new_release" as const,
      name: `WB Arrival ${index + 1}`,
      price: 1000 + index,
      url: `https://whiskybrother.com/products/wb-arrival-${index + 1}`,
      inStock: true,
      relevanceScore: 60,
      whyItMatters: "",
      citations: []
    }));

    const result = enforceRetailerOfferRules([], newArrivals);

    expect(result.newArrivals).toHaveLength(10);
    expect(result.newArrivals[0]?.name).toBe("WB Arrival 1");
    expect(result.newArrivals[9]?.name).toBe("WB Arrival 10");
  });

  it("removes sold-out and obvious non-whisky Bottega items", () => {
    const result = enforceRetailerOfferRules(
      [
        {
          source: "bottegawhiskey",
          kind: "special",
          name: "Don Julio Tequila",
          price: 1000,
          url: "https://bottegawhiskey.com/products/don-julio",
          inStock: true,
          relevanceScore: 60,
          whyItMatters: "",
          citations: []
        },
        {
          source: "bottegawhiskey",
          kind: "special",
          name: "Ardbeg Uigeadail",
          price: 1200,
          url: "https://bottegawhiskey.com/products/ardbeg-uigeadail",
          inStock: true,
          relevanceScore: 70,
          whyItMatters: "",
          citations: []
        }
      ],
      [
        {
          source: "bottegawhiskey",
          kind: "new_release",
          name: "Hendrick's Gin",
          price: 900,
          url: "https://bottegawhiskey.com/products/hendricks-gin",
          inStock: true,
          relevanceScore: 55,
          whyItMatters: "",
          citations: []
        },
        {
          source: "bottegawhiskey",
          kind: "new_release",
          name: "Bunnahabhain 12",
          price: 1100,
          url: "https://bottegawhiskey.com/products/bunnahabhain-12",
          inStock: false,
          relevanceScore: 65,
          whyItMatters: "",
          citations: []
        }
      ]
    );

    expect(result.specials).toHaveLength(1);
    expect(result.specials[0]?.name).toBe("Ardbeg Uigeadail");
    expect(result.newArrivals).toHaveLength(0);
  });

  it("caps Bottega new arrivals at the first 10 in-stock whiskies", () => {
    const newArrivals = [
      ...Array.from({ length: 8 }, (_, index) => ({
        source: "bottegawhiskey" as const,
        kind: "new_release" as const,
        name: `Bottega Whisky ${index + 1}`,
        price: 1000 + index,
        url: `https://bottegawhiskey.com/products/bottega-whisky-${index + 1}`,
        inStock: true,
        relevanceScore: 60,
        whyItMatters: "",
        citations: []
      })),
      {
        source: "bottegawhiskey" as const,
        kind: "new_release" as const,
        name: "Bottega Tequila",
        price: 999,
        url: "https://bottegawhiskey.com/products/bottega-tequila",
        inStock: true,
        relevanceScore: 50,
        whyItMatters: "",
        citations: []
      },
      ...Array.from({ length: 5 }, (_, index) => ({
        source: "bottegawhiskey" as const,
        kind: "new_release" as const,
        name: `Bottega Whisky ${index + 9}`,
        price: 1010 + index,
        url: `https://bottegawhiskey.com/products/bottega-whisky-${index + 9}`,
        inStock: true,
        relevanceScore: 60,
        whyItMatters: "",
        citations: []
      }))
    ];

    const result = enforceRetailerOfferRules([], newArrivals);

    expect(result.newArrivals).toHaveLength(10);
    expect(result.newArrivals[0]?.name).toBe("Bottega Whisky 1");
    expect(result.newArrivals[9]?.name).toBe("Bottega Whisky 10");
    expect(result.newArrivals.find(item => item.name === "Bottega Tequila")).toBeUndefined();
  });

  it("caps Whisky Emporium new arrivals at the first 10 in-stock whiskies and drops specials", () => {
    const specials = [
      {
        source: "whiskyemporium" as const,
        kind: "special" as const,
        name: "Should Not Surface",
        price: 999,
        url: "https://whiskyemporium.co.za/product/should-not-surface/",
        inStock: true,
        relevanceScore: 70,
        whyItMatters: "",
        citations: []
      }
    ];

    const newArrivals = Array.from({ length: 12 }, (_, index) => ({
      source: "whiskyemporium" as const,
      kind: "new_release" as const,
      name: `Emporium Bottle ${index + 1}`,
      price: 1000 + index,
      url: `https://whiskyemporium.co.za/product/emporium-bottle-${index + 1}/`,
      inStock: true,
      relevanceScore: 60,
      whyItMatters: "",
      citations: []
    }));

    const result = enforceRetailerOfferRules(specials, newArrivals);

    expect(result.specials).toHaveLength(0);
    expect(result.newArrivals).toHaveLength(10);
    expect(result.newArrivals[0]?.name).toBe("Emporium Bottle 1");
    expect(result.newArrivals[9]?.name).toBe("Emporium Bottle 10");
  });

  it("removes obvious non-whisky Mother City sale items while keeping whiskies", () => {
    const result = enforceRetailerOfferRules(
      [
        {
          source: "mothercityliquor",
          kind: "special",
          name: "Patron Tequila Reposado",
          price: 900,
          url: "https://mothercityliquor.co.za/products/patron-tequila-reposado",
          inStock: true,
          relevanceScore: 50,
          whyItMatters: "",
          citations: []
        },
        {
          source: "mothercityliquor",
          kind: "special",
          name: "Talisker 10 Year Old",
          price: 1000,
          url: "https://mothercityliquor.co.za/products/talisker-10-year-old",
          inStock: true,
          relevanceScore: 70,
          whyItMatters: "",
          citations: []
        }
      ],
      []
    );

    expect(result.specials).toHaveLength(1);
    expect(result.specials[0]?.name).toBe("Talisker 10 Year Old");
  });

  it("removes Norman Goodfellows new arrivals entirely", () => {
    const result = enforceRetailerOfferRules(
      [],
      [
        {
          source: "normangoodfellows",
          kind: "new_release",
          name: "NGF New Arrival",
          price: 1000,
          url: "https://www.ngf.co.za/products/ngf-new-arrival",
          inStock: true,
          relevanceScore: 60,
          whyItMatters: "",
          citations: []
        }
      ]
    );

    expect(result.newArrivals).toHaveLength(0);
  });
});
