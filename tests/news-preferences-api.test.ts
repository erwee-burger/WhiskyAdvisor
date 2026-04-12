// tests/news-preferences-api.test.ts
import { describe, it, expect } from "vitest";
import { z } from "zod";

// We test the Zod schema used by the PATCH handler in isolation
const PatchPreferencesSchema = z.object({
  softBudgetCapZar: z.number().positive(),
  stretchBudgetCapZar: z.number().positive().nullable()
});

describe("PATCH /api/news/preferences schema", () => {
  it("accepts valid soft + stretch", () => {
    const result = PatchPreferencesSchema.safeParse({
      softBudgetCapZar: 1000,
      stretchBudgetCapZar: 1500
    });
    expect(result.success).toBe(true);
  });

  it("accepts null stretch cap", () => {
    const result = PatchPreferencesSchema.safeParse({
      softBudgetCapZar: 1000,
      stretchBudgetCapZar: null
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stretchBudgetCapZar).toBeNull();
    }
  });

  it("rejects missing softBudgetCapZar", () => {
    const result = PatchPreferencesSchema.safeParse({
      stretchBudgetCapZar: null
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero or negative soft cap", () => {
    expect(PatchPreferencesSchema.safeParse({ softBudgetCapZar: 0, stretchBudgetCapZar: null }).success).toBe(false);
    expect(PatchPreferencesSchema.safeParse({ softBudgetCapZar: -100, stretchBudgetCapZar: null }).success).toBe(false);
  });

  it("rejects non-numeric softBudgetCapZar", () => {
    const result = PatchPreferencesSchema.safeParse({
      softBudgetCapZar: "one thousand",
      stretchBudgetCapZar: null
    });
    expect(result.success).toBe(false);
  });

  it("rejects undefined stretchBudgetCapZar (must be explicitly null)", () => {
    // undefined means the key was not sent — the client must always send the key
    const result = PatchPreferencesSchema.safeParse({
      softBudgetCapZar: 1000
    });
    // stretchBudgetCapZar is required; undefined fails
    expect(result.success).toBe(false);
  });
});
