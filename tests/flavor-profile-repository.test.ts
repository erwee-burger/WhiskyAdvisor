import { describe, expect, it } from "vitest";

import { classifyExpressionFlavor } from "@/lib/flavor-profile-repository";
import type { Expression } from "@/lib/types";

function buildExpression(overrides: Partial<Expression> = {}): Expression {
  return {
    id: "expr_test",
    name: "Test Bottle",
    tags: ["single-malt", "sherry-cask", "heavily-peated", "cask-strength"],
    tastingNotes: [
      "Sooty peat smoke",
      "Briny sea spray",
      "Charred oak",
      "Raisin and dried fig",
      "Dark chocolate",
      "Clove spice",
      "Leather",
      "Buckwheat honey"
    ],
    description: "A smoky single cask Islay bottling.",
    abv: 56.2,
    ageStatement: 10,
    ...overrides
  };
}

describe("classifyExpressionFlavor", () => {
  it("keeps confidence below certainty for web-synthesized notes", () => {
    const profile = classifyExpressionFlavor(buildExpression());

    expect(profile.confidence).toBeLessThanOrEqual(0.82);
    expect(profile.confidence).toBeGreaterThanOrEqual(0.24);
  });

  it("uses a neutral summary explanation instead of echoing raw notes", () => {
    const profile = classifyExpressionFlavor(buildExpression());

    expect(profile.explanation).toBe("Weighted from 8 tasting notes and bounded structural traits.");
  });
});
