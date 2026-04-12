// lib/news-budget.ts
import type { BudgetFit, NewsBudgetPreferences } from "@/lib/types";

export function computeBudgetFit(
  price: number,
  prefs: NewsBudgetPreferences
): BudgetFit {
  if (price <= prefs.softBudgetCapZar) return "in_budget";
  if (prefs.stretchBudgetCapZar !== null) {
    if (price <= prefs.stretchBudgetCapZar) return "stretch";
    return "over_budget";
  }
  return "above_budget";
}
