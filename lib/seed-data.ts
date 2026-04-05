import type { WhiskyStore } from "@/lib/types";

const today = "2026-04-05T09:00:00.000Z";

export const seedStore: WhiskyStore = {
  distilleries: [
    {
      id: "dist_lagavulin",
      name: "Lagavulin",
      country: "Scotland",
      region: "Islay",
      foundedYear: 1816,
      notes: "Iconic peated malt with maritime smoke and dense sweetness."
    },
    {
      id: "dist_ben_nevis",
      name: "Ben Nevis",
      country: "Scotland",
      region: "Highlands",
      foundedYear: 1825,
      notes: "Robust Highland malt that takes independent bottlings beautifully."
    },
    {
      id: "dist_springbank",
      name: "Springbank",
      country: "Scotland",
      region: "Campbeltown",
      foundedYear: 1828,
      notes: "Famous for oily, coastal complexity and hands-on production."
    },
    {
      id: "dist_kavalan",
      name: "Kavalan",
      country: "Taiwan",
      region: "Yilan",
      foundedYear: 2005,
      notes: "Tropical and cask-driven world whisky distillery."
    },
    {
      id: "dist_bruichladdich",
      name: "Bruichladdich",
      country: "Scotland",
      region: "Islay",
      foundedYear: 1881,
      notes: "Unpeated and peated expressions with modern transparency."
    }
  ],
  bottlers: [
    {
      id: "bot_lagavulin",
      name: "Lagavulin",
      bottlerKind: "official",
      country: "Scotland"
    },
    {
      id: "bot_signatory",
      name: "Signatory Vintage",
      bottlerKind: "independent",
      country: "Scotland",
      notes: "Independent bottler known for cask-specific releases."
    },
    {
      id: "bot_springbank",
      name: "Springbank",
      bottlerKind: "official",
      country: "Scotland"
    },
    {
      id: "bot_kavalan",
      name: "Kavalan",
      bottlerKind: "official",
      country: "Taiwan"
    },
    {
      id: "bot_bruichladdich",
      name: "Bruichladdich",
      bottlerKind: "official",
      country: "Scotland"
    }
  ],
  expressions: [
    {
      id: "expr_lagavulin_16",
      name: "Lagavulin 16 Year Old",
      distilleryId: "dist_lagavulin",
      bottlerId: "bot_lagavulin",
      bottlerKind: "official",
      whiskyType: "single-malt",
      country: "Scotland",
      region: "Islay",
      abv: 43,
      ageStatement: "16",
      peatLevel: "heavily-peated",
      caskInfluence: "sherry",
      flavorTags: ["smoke", "sea-salt", "dried-fruit", "iodine", "dark-chocolate"],
      barcode: "5000281005408",
      description: "Benchmark Islay whisky with dense smoke and dried fruit depth.",
      imageUrl:
        "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=1200&q=80"
    },
    {
      id: "expr_ben_nevis_signatory",
      name: "Ben Nevis 2015 Signatory Cask Strength",
      distilleryId: "dist_ben_nevis",
      bottlerId: "bot_signatory",
      bottlerKind: "independent",
      whiskyType: "single-malt",
      releaseSeries: "Cask Strength Collection",
      country: "Scotland",
      region: "Highlands",
      abv: 57.1,
      vintageYear: 2015,
      distilledYear: 2015,
      bottledYear: 2025,
      caskType: "1st fill oloroso butt",
      caskNumber: "900182",
      bottleNumber: "112/642",
      outturn: "642 bottles",
      peatLevel: "light",
      caskInfluence: "sherry",
      flavorTags: ["walnut", "dark-fruit", "oily", "orange-peel", "leather"],
      barcode: "5021944123488",
      description: "Muscular Highland spirit with deep oloroso character and orange peel lift.",
      imageUrl:
        "https://images.unsplash.com/photo-1516997121675-4c2d1684aa3e?auto=format&fit=crop&w=1200&q=80"
    },
    {
      id: "expr_springbank_10",
      name: "Springbank 10 Year Old",
      distilleryId: "dist_springbank",
      bottlerId: "bot_springbank",
      bottlerKind: "official",
      whiskyType: "single-malt",
      country: "Scotland",
      region: "Campbeltown",
      abv: 46,
      ageStatement: "10",
      peatLevel: "medium",
      caskInfluence: "mixed",
      flavorTags: ["coastal", "toffee", "citrus", "engine-oil", "malt"],
      barcode: "610854001356",
      description: "Coastal, slightly funky, and brilliantly balanced.",
      imageUrl:
        "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=1200&q=80"
    },
    {
      id: "expr_kavalan_vinho",
      name: "Kavalan Solist Vinho Barrique",
      distilleryId: "dist_kavalan",
      bottlerId: "bot_kavalan",
      bottlerKind: "official",
      whiskyType: "world-single-malt",
      releaseSeries: "Solist",
      country: "Taiwan",
      region: "Yilan",
      abv: 57.8,
      peatLevel: "unpeated",
      caskInfluence: "wine",
      flavorTags: ["tropical-fruit", "vanilla", "berry-jam", "spice", "chocolate"],
      barcode: "4710085225318",
      description: "Tropical, wine-cask-forward, and lush.",
      imageUrl:
        "https://images.unsplash.com/photo-1516997121675-4c2d1684aa3e?auto=format&fit=crop&w=1200&q=80"
    },
    {
      id: "expr_port_charlotte_10",
      name: "Port Charlotte 10 Year Old",
      distilleryId: "dist_bruichladdich",
      bottlerId: "bot_bruichladdich",
      bottlerKind: "official",
      whiskyType: "single-malt",
      releaseSeries: "Port Charlotte",
      country: "Scotland",
      region: "Islay",
      abv: 50,
      ageStatement: "10",
      peatLevel: "heavily-peated",
      caskInfluence: "bourbon",
      flavorTags: ["barbecue", "ash", "lemon", "vanilla", "malt"],
      barcode: "5055807415389",
      description: "Modern smoky Islay whisky with bright citrus and malty sweetness.",
      imageUrl:
        "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=1200&q=80"
    }
  ],
  collectionItems: [
    {
      id: "item_lagavulin",
      expressionId: "expr_lagavulin_16",
      status: "owned",
      fillState: "open",
      purchasePrice: 1850,
      purchaseCurrency: "ZAR",
      purchaseDate: "2025-11-22",
      purchaseSource: "Norman Goodfellows Sandton",
      openedDate: "2025-12-31",
      personalNotes: "The rainy-evening benchmark.",
      createdAt: today,
      updatedAt: today
    },
    {
      id: "item_ben_nevis",
      expressionId: "expr_ben_nevis_signatory",
      status: "owned",
      fillState: "sealed",
      purchaseCurrency: "GBP",
      purchaseSource: "The Whisky Exchange",
      personalNotes: "Saving this for a proper sherry-head evening.",
      createdAt: today,
      updatedAt: today
    },
    {
      id: "item_springbank",
      expressionId: "expr_springbank_10",
      status: "owned",
      fillState: "sealed",
      purchasePrice: 1999,
      purchaseCurrency: "ZAR",
      purchaseDate: "2026-01-14",
      purchaseSource: "WhiskyBrother",
      personalNotes: "Should probably open soon.",
      createdAt: today,
      updatedAt: today
    },
    {
      id: "item_kavalan",
      expressionId: "expr_kavalan_vinho",
      status: "wishlist",
      fillState: "sealed",
      purchaseCurrency: "ZAR",
      personalNotes: "Want this as the tropical contrast to the peated shelf.",
      createdAt: today,
      updatedAt: today
    }
  ],
  tastingEntries: [
    {
      id: "taste_lagavulin_1",
      collectionItemId: "item_lagavulin",
      tastedAt: "2026-01-08",
      nose: "Smoked citrus, bandages, sea breeze, and treacle.",
      palate: "Dense peat, raisins, black tea, and salty caramel.",
      finish: "Long, drying, coastal, and ashy with a sweet tail.",
      overallNote: "Still the reference point when I want full smoke with real depth.",
      rating: 5
    },
    {
      id: "taste_lagavulin_2",
      collectionItemId: "item_lagavulin",
      tastedAt: "2026-03-02",
      nose: "More polished now, with leather and orange oil.",
      palate: "Smoke and dried fruit, but less sharp than the first pour.",
      finish: "Long and savory with dark chocolate bitterness.",
      overallNote: "Opened up beautifully after a few months.",
      rating: 4
    },
    {
      id: "taste_springbank_1",
      collectionItemId: "item_springbank",
      tastedAt: "2026-02-18",
      nose: "Dunnage funk, citrus zest, and barley sugar.",
      palate: "Oily texture, salted toffee, and gentle peat.",
      finish: "Medium-long, mineral, slightly waxy.",
      overallNote: "Quirkier than the label suggests.",
      rating: 5
    }
  ],
  itemImages: [
    {
      id: "img_lagavulin_front",
      collectionItemId: "item_lagavulin",
      kind: "front",
      url: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=1200&q=80",
      label: "Front label"
    },
    {
      id: "img_ben_nevis_front",
      collectionItemId: "item_ben_nevis",
      kind: "front",
      url: "https://images.unsplash.com/photo-1516997121675-4c2d1684aa3e?auto=format&fit=crop&w=1200&q=80",
      label: "Front label"
    },
    {
      id: "img_springbank_front",
      collectionItemId: "item_springbank",
      kind: "front",
      url: "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=1200&q=80",
      label: "Front label"
    }
  ],
  citations: [
    {
      id: "cit_lagavulin_desc",
      entityType: "expression",
      entityId: "expr_lagavulin_16",
      field: "description",
      label: "Lagavulin official tasting note",
      url: "https://www.malts.com/en-row/products/single-malt-whisky/lagavulin-16-year-old-single-malt-scotch-whisky",
      sourceKind: "official",
      confidence: 0.92,
      createdAt: today
    },
    {
      id: "cit_ben_nevis_series",
      entityType: "expression",
      entityId: "expr_ben_nevis_signatory",
      field: "releaseSeries",
      label: "Signatory Vintage release page",
      url: "https://www.signatoryvintage.com",
      sourceKind: "official",
      confidence: 0.88,
      createdAt: today
    }
  ],
  priceSnapshots: [
    {
      id: "price_lagavulin",
      expressionId: "expr_lagavulin_16",
      refreshedAt: "2026-04-04T13:20:00.000Z",
      retail: {
        sourceKind: "retail",
        currency: "ZAR",
        low: 2199,
        high: 2499,
        lowZar: 2199,
        highZar: 2499,
        confidence: 0.91,
        refreshedAt: "2026-04-04T13:20:00.000Z",
        sources: [
          {
            label: "WhiskyBrother",
            url: "https://www.whiskybrother.com",
            currency: "ZAR",
            amount: 2199,
            normalizedZar: 2199,
            confidence: 0.92
          },
          {
            label: "Norman Goodfellows",
            url: "https://www.ngf.co.za",
            currency: "ZAR",
            amount: 2499,
            normalizedZar: 2499,
            confidence: 0.9
          }
        ]
      }
    },
    {
      id: "price_ben_nevis",
      expressionId: "expr_ben_nevis_signatory",
      refreshedAt: "2026-04-04T13:20:00.000Z",
      retail: {
        sourceKind: "retail",
        currency: "GBP",
        low: 92,
        high: 109,
        lowZar: 2175.8,
        highZar: 2577.85,
        confidence: 0.79,
        refreshedAt: "2026-04-04T13:20:00.000Z",
        sources: [
          {
            label: "The Whisky Exchange",
            url: "https://www.thewhiskyexchange.com",
            currency: "GBP",
            amount: 92,
            normalizedZar: 2175.8,
            confidence: 0.82
          },
          {
            label: "Master of Malt",
            url: "https://www.masterofmalt.com",
            currency: "GBP",
            amount: 109,
            normalizedZar: 2577.85,
            confidence: 0.76
          }
        ]
      },
      auction: {
        sourceKind: "auction",
        currency: "GBP",
        low: 78,
        high: 95,
        lowZar: 1844.7,
        highZar: 2246.75,
        confidence: 0.68,
        refreshedAt: "2026-04-04T13:20:00.000Z",
        sources: [
          {
            label: "Whisky Auctioneer",
            url: "https://whiskyauctioneer.com",
            currency: "GBP",
            amount: 78,
            normalizedZar: 1844.7,
            confidence: 0.69
          },
          {
            label: "Scotch Whisky Auctions",
            url: "https://www.scotchwhiskyauctions.com",
            currency: "GBP",
            amount: 95,
            normalizedZar: 2246.75,
            confidence: 0.67
          }
        ]
      }
    },
    {
      id: "price_springbank",
      expressionId: "expr_springbank_10",
      refreshedAt: "2026-04-04T13:20:00.000Z",
      retail: {
        sourceKind: "retail",
        currency: "ZAR",
        low: 2099,
        high: 2499,
        lowZar: 2099,
        highZar: 2499,
        confidence: 0.83,
        refreshedAt: "2026-04-04T13:20:00.000Z",
        sources: [
          {
            label: "WhiskyBrother",
            url: "https://www.whiskybrother.com",
            currency: "ZAR",
            amount: 2099,
            normalizedZar: 2099,
            confidence: 0.84
          },
          {
            label: "Mothercity Liquor",
            url: "https://www.mothercityliquor.co.za",
            currency: "ZAR",
            amount: 2499,
            normalizedZar: 2499,
            confidence: 0.81
          }
        ]
      },
      auction: {
        sourceKind: "auction",
        currency: "GBP",
        low: 112,
        high: 138,
        lowZar: 2648.8,
        highZar: 3263.7,
        confidence: 0.77,
        refreshedAt: "2026-04-04T13:20:00.000Z",
        sources: [
          {
            label: "Whisky Auctioneer",
            url: "https://whiskyauctioneer.com",
            currency: "GBP",
            amount: 112,
            normalizedZar: 2648.8,
            confidence: 0.79
          },
          {
            label: "Scotch Whisky Auctions",
            url: "https://www.scotchwhiskyauctions.com",
            currency: "GBP",
            amount: 138,
            normalizedZar: 3263.7,
            confidence: 0.75
          }
        ]
      }
    },
    {
      id: "price_kavalan",
      expressionId: "expr_kavalan_vinho",
      refreshedAt: "2026-04-04T13:20:00.000Z",
      retail: {
        sourceKind: "retail",
        currency: "USD",
        low: 179,
        high: 225,
        lowZar: 3302.55,
        highZar: 4151.25,
        confidence: 0.8,
        refreshedAt: "2026-04-04T13:20:00.000Z",
        sources: [
          {
            label: "CaskCartel",
            url: "https://caskcartel.com",
            currency: "USD",
            amount: 179,
            normalizedZar: 3302.55,
            confidence: 0.75
          },
          {
            label: "Mission Liquor",
            url: "https://www.missionliquor.com",
            currency: "USD",
            amount: 225,
            normalizedZar: 4151.25,
            confidence: 0.84
          }
        ]
      }
    }
  ],
  drafts: []
};
