import { describe, expect, it } from "vitest";

import {
  quickBottleShareSchema,
  tastingPersonSchema,
  tastingSessionSchema
} from "@/lib/schemas";

describe("tastingPersonSchema", () => {
  it("normalizes comma-delimited preference tags", () => {
    const parsed = tastingPersonSchema.parse({
      name: "Alex",
      relationshipType: "friend",
      preferenceTags: "Peated, sherry, Springbank ",
      notes: "Always up for a smoky bottle."
    });

    expect(parsed.preferenceTags).toEqual(["peated", "sherry", "springbank"]);
  });
});

describe("tastingSessionSchema", () => {
  it("requires at least one bottle", () => {
    const result = tastingSessionSchema.safeParse({
      occasionType: "visit",
      sessionDate: "2026-04-14T18:00:00.000Z",
      attendeePersonIds: [],
      bottleItemIds: []
    });

    expect(result.success).toBe(false);
  });
});

describe("quickBottleShareSchema", () => {
  it("requires at least one person or group", () => {
    const result = quickBottleShareSchema.safeParse({
      occasionType: "visit",
      sessionDate: "2026-04-14T18:00:00.000Z",
      collectionItemId: "item_lagavulin",
      attendeePersonIds: []
    });

    expect(result.success).toBe(false);
  });
});
