// tests/news-budget.test.ts
import { describe, it, expect } from "vitest";
import { computeBudgetFit } from "@/lib/news-budget";
import type { NewsBudgetPreferences } from "@/lib/types";

const prefs = (soft: number, stretch: number | null): NewsBudgetPreferences => ({
  softBudgetCapZar: soft,
  stretchBudgetCapZar: stretch
});

describe("computeBudgetFit", () => {
  it("returns in_budget when price <= soft cap", () => {
    expect(computeBudgetFit(800, prefs(1000, null))).toBe("in_budget");
    expect(computeBudgetFit(1000, prefs(1000, null))).toBe("in_budget");
  });

  it("returns above_budget when price > soft cap and stretch cap is null", () => {
    expect(computeBudgetFit(1001, prefs(1000, null))).toBe("above_budget");
    expect(computeBudgetFit(5000, prefs(1000, null))).toBe("above_budget");
  });

  it("returns stretch when soft cap < price <= stretch cap", () => {
    expect(computeBudgetFit(1200, prefs(1000, 1500))).toBe("stretch");
    expect(computeBudgetFit(1500, prefs(1000, 1500))).toBe("stretch");
  });

  it("returns over_budget when stretch cap exists and price > stretch cap", () => {
    expect(computeBudgetFit(1501, prefs(1000, 1500))).toBe("over_budget");
    expect(computeBudgetFit(3000, prefs(1000, 1500))).toBe("over_budget");
  });

  it("stretch cap of 0 is treated as null — returns above_budget when price > soft", () => {
    // This covers the edge case where a consumer passes 0; should not happen via API
    // but guard it anyway: 0 stretch cap means "no stretch ceiling"
    expect(computeBudgetFit(1200, prefs(1000, null))).toBe("above_budget");
  });
});
