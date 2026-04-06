import type { WhiskyStore } from "@/lib/types";

const today = "2026-04-05T09:00:00.000Z";

export const seedStore: WhiskyStore = {
  expressions: [
    {
      id: "expr_lagavulin_16",
      distilleryName: "Lagavulin",
      bottlerName: "Lagavulin",
      brand: "Lagavulin",
      name: "Lagavulin 16 Year Old",
      country: "Scotland",
      abv: 43,
      ageStatement: 16,
      barcode: "5000281005408",
      description: "Benchmark Islay whisky with dense smoke and dried fruit depth.",
      imageUrl:
        "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=1200&q=80",
      tags: [
        "single-malt",
        "heavily-peated",
        "sherry-cask",
        "chill-filtered",
        "smoke",
        "sea-salt",
        "dried-fruit",
        "iodine",
        "dark-chocolate",
        "16yo"
      ]
    },
    {
      id: "expr_ben_nevis_signatory",
      distilleryName: "Ben Nevis",
      bottlerName: "Signatory Vintage",
      brand: "Signatory Vintage",
      name: "Ben Nevis 2015 Signatory Cask Strength",
      country: "Scotland",
      abv: 57.1,
      ageStatement: undefined,
      barcode: "5021944123488",
      description: "Muscular Highland spirit with deep oloroso character and orange peel lift.",
      imageUrl:
        "https://images.unsplash.com/photo-1516997121675-4c2d1684aa3e?auto=format&fit=crop&w=1200&q=80",
      tags: [
        "single-malt",
        "independent-bottler",
        "peated",
        "sherry-cask",
        "natural-colour",
        "limited",
        "nas",
        "walnut",
        "dark-fruit",
        "oily",
        "orange-peel",
        "leather",
        "cask-strength",
        "2015-vintage",
        "700ml",
        "642-outturn"
      ]
    },
    {
      id: "expr_springbank_10",
      distilleryName: "Springbank",
      bottlerName: "Springbank",
      brand: "Springbank",
      name: "Springbank 10 Year Old",
      country: "Scotland",
      abv: 46,
      ageStatement: 10,
      barcode: "610854001356",
      description: "Coastal, slightly funky, and brilliantly balanced.",
      imageUrl:
        "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=1200&q=80",
      tags: [
        "single-malt",
        "peated",
        "bourbon-cask",
        "natural-colour",
        "coastal",
        "toffee",
        "citrus",
        "engine-oil",
        "malt",
        "10yo"
      ]
    },
    {
      id: "expr_kavalan_vinho",
      distilleryName: "Kavalan",
      bottlerName: "Kavalan",
      brand: "Kavalan",
      name: "Kavalan Solist Vinho Barrique",
      country: "Taiwan",
      abv: 57.8,
      ageStatement: undefined,
      barcode: "4710085225318",
      description: "Tropical, wine-cask-forward, and lush.",
      imageUrl:
        "https://images.unsplash.com/photo-1516997121675-4c2d1684aa3e?auto=format&fit=crop&w=1200&q=80",
      tags: [
        "world-single-malt",
        "wine-cask",
        "natural-colour",
        "limited",
        "nas",
        "tropical-fruit",
        "vanilla",
        "berry-jam",
        "spice",
        "chocolate",
        "solist"
      ]
    },
    {
      id: "expr_port_charlotte_10",
      distilleryName: "Bruichladdich",
      bottlerName: "Bruichladdich",
      brand: "Port Charlotte",
      name: "Port Charlotte 10 Year Old",
      country: "Scotland",
      abv: 50,
      ageStatement: 10,
      barcode: "5055807415389",
      description: "Modern smoky Islay whisky with bright citrus and malty sweetness.",
      imageUrl:
        "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=1200&q=80",
      tags: [
        "single-malt",
        "heavily-peated",
        "bourbon-cask",
        "natural-colour",
        "barbecue",
        "ash",
        "lemon",
        "vanilla",
        "malt",
        "10yo",
        "port-charlotte"
      ]
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
  drafts: []
};
