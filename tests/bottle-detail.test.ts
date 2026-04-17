import { describe, expect, it } from "vitest";

import {
  areSuggestionValuesEqual,
  buildBottleDetailFormState,
  buildSuggestionDiff,
  enrichBottleFieldRequestSchema
} from "@/lib/bottle-detail";
import type { CollectionViewItem } from "@/lib/types";

const sampleEntry: CollectionViewItem = {
  item: {
    id: "item_1",
    expressionId: "expr_1",
    status: "owned",
    fillState: "sealed",
    purchasePrice: 999,
    purchaseCurrency: "ZAR",
    purchaseDate: "2026-04-01",
    purchaseSource: "Whisky Brother",
    personalNotes: "Benchmark bottle",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-02T00:00:00.000Z"
  },
  expression: {
    id: "expr_1",
    name: "Springbank 15",
    brand: "Springbank",
    distilleryName: "Springbank",
    bottlerName: "Springbank",
    country: "Scotland",
    abv: 46,
    ageStatement: 15,
    barcode: "610854001772",
    description: "Sherry-forward Campbeltown single malt.",
    tastingNotes: ["dried fruit", "orange peel", "oak"],
    tags: ["single-malt", "sherry-cask", "campbeltown"]
  },
  images: []
};

describe("bottle detail helpers", () => {
  it("builds the editable form state from a collection entry", () => {
    const formState = buildBottleDetailFormState(sampleEntry);

    expect(formState.name).toBe("Springbank 15");
    expect(formState.abv).toBe("46");
    expect(formState.tags).toBe("single-malt, sherry-cask, campbeltown");
    expect(formState.tastingNotes).toBe("dried fruit, orange peel, oak");
    expect(formState.purchasePrice).toBe("999");
  });

  it("builds added and removed tag diffs", () => {
    const diff = buildSuggestionDiff(
      "tags",
      ["single-malt", "sherry-cask"],
      ["single-malt", "peated", "campbeltown"]
    );

    expect(diff).not.toBeNull();
    expect(diff?.kind).toBe("tags");
    expect(diff && diff.kind === "tags" ? diff.removed : []).toEqual(["sherry-cask"]);
    expect(diff && diff.kind === "tags" ? diff.added : []).toEqual(["peated", "campbeltown"]);
  });

  it("builds a text diff for string suggestions", () => {
    const diff = buildSuggestionDiff(
      "description",
      "Rich dried fruit and oak.",
      "Rich dried fruit, dark chocolate, and polished oak."
    );

    expect(diff).not.toBeNull();
    expect(diff?.kind).toBe("text");
    expect(diff && diff.kind === "text" ? diff.addedText.length : 0).toBeGreaterThan(0);
  });

  it("treats tag suggestions as equal even when order changes", () => {
    expect(
      areSuggestionValuesEqual(
        "tags",
        ["single-malt", "sherry-cask"],
        ["sherry-cask", "single-malt"]
      )
    ).toBe(true);
  });

  it("validates supported enrich request fields and rejects unsupported ones", () => {
    expect(
      enrichBottleFieldRequestSchema.safeParse({
        field: "purchasePrice",
        currentValue: 1299,
        draftValues: buildBottleDetailFormState(sampleEntry)
      }).success
    ).toBe(true);

    expect(
      enrichBottleFieldRequestSchema.safeParse({
        field: "status",
        currentValue: "owned",
        draftValues: buildBottleDetailFormState(sampleEntry)
      }).success
    ).toBe(false);
  });
});
