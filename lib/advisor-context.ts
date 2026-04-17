import type {
  AdvisorSuggestion,
  CollectionViewItem,
  NewsBudgetPreferences,
  NewsFeedItem,
  PalateProfile,
  TastingSessionView
} from "@/lib/types";
import { buildCollectionAnalytics } from "@/lib/analytics";

export interface ContextTriggers {
  drinkNow: boolean;
  wishlist: boolean;
  analytics: boolean;
  tastings: boolean;
  socialPlanning: boolean;
  deals: boolean;
  bottleName: string | null;
}

export function detectContextTriggers(query: string): ContextTriggers {
  const q = query.toLowerCase();

  const drinkNow = /open tonight|drink now|what should i have|what should i open|pour tonight/.test(q);
  const wishlist = /buy next|next purchase|wishlist|should i get|worth (it|buying)/.test(q);
  const analytics = /how many|collection stats|analytics|how much|total|count/.test(q);
  const tastings = /my notes|tasting notes|rating|rated|my review|favorites|favourites/.test(q);
  const socialPlanning =
    /\btake\b|\bbring\b|\bvisit\b|going to|friday|whisky friday|whisky club|with my friends|with my family|with colleagues|with my colleague/.test(
      q
    );
  const deals = /special|deal|discount|on sale|new release|just arrived|what.s new/.test(q);

  // Extract a bottle name if the query mentions one — grab text after keywords like "my" or "about"
  // Try matching "tell me about my" first, then other patterns
  let bottleName: string | null = null;
  const match1 = q.match(/tell me about\s+my\s+([a-z0-9 ]+?)(?:\?|$|,|\.|right)/);
  const match2 = q.match(/about\s+([a-z0-9 ]+?)(?:\?|$|,|\.|right)/);
  const match3 = q.match(/my\s+([a-z0-9 ]+?)(?:\?|$|,|\.|right)/);

  if (match1) {
    bottleName = match1[1].trim();
  } else if (match2) {
    bottleName = match2[1].trim();
  } else if (match3) {
    bottleName = match3[1].trim();
  }

  return { drinkNow, wishlist, analytics, tastings, socialPlanning, deals, bottleName };
}

export function buildCollectionSummary(items: CollectionViewItem[]): string {
  const analytics = buildCollectionAnalytics(items);
  const topRegions = analytics.regionSplit.slice(0, 3).map(r => r.region).join(", ");
  const topDistilleries = analytics.topDistilleries.slice(0, 3).map(d => d.name).join(", ");

  return [
    `Collection: ${analytics.totals.owned} owned, ${analytics.totals.wishlist} on wishlist.`,
    `Open bottles: ${analytics.totals.open}. Sealed: ${analytics.totals.sealed}. Finished: ${analytics.totals.finished}.`,
    topRegions ? `Top regions: ${topRegions}.` : "",
    topDistilleries ? `Top distilleries: ${topDistilleries}.` : ""
  ].filter(Boolean).join(" ");
}

export function buildPalateContextBlock(profile: PalateProfile): string {
  const lines = [
    "PALATE PROFILE:",
    profile.favoredPeatTag ? `Peat preference: ${profile.favoredPeatTag}` : "Peat preference: unknown (no tasting data yet)",
    profile.favoredRegions.length ? `Favored regions: ${profile.favoredRegions.join(", ")}` : "Favored regions: none yet",
    profile.favoredCaskStyles.length ? `Favored cask styles: ${profile.favoredCaskStyles.join(", ")}` : "Favored cask styles: none yet",
    profile.favoredFlavorTags.length ? `Top tasting notes: ${profile.favoredFlavorTags.join(", ")}` : "Tasting notes: none yet"
  ];
  return lines.join("\n");
}

export function buildSuggestionsBlock(drinkNow: AdvisorSuggestion[], buyNext: AdvisorSuggestion[]): string {
  const dnLines = drinkNow.slice(0, 4).map(s => `  - ${s.title} (score: ${s.score}) — ${s.rationale}`);
  const bnLines = buyNext.slice(0, 4).map(s => `  - ${s.title} (score: ${s.score}) — ${s.rationale}`);
  return [
    "CURRENT ADVISOR PICKS:",
    "Drink now:",
    ...dnLines,
    "Buy next:",
    ...bnLines
  ].join("\n");
}

export function buildDrinkNowBlock(items: CollectionViewItem[]): string {
  const open = items.filter(i => i.item.status === "owned" && i.item.fillState !== "finished");
  const lines = open.map(i => {
    const ratingStr = i.item.rating ? ` (rated ${i.item.rating}/3${i.item.isFavorite ? " ★ favorite" : ""})` : "";
    return `  - ${i.expression.name}${ratingStr} [${i.item.fillState}]`;
  });
  return ["OWNED BOTTLES AVAILABLE TO DRINK:", ...lines].join("\n");
}

export function buildWishlistBlock(items: CollectionViewItem[]): string {
  const wishlist = items.filter(i => i.item.status === "wishlist");
  const lines = wishlist.map(i => {
    const price = i.item.purchasePrice ? ` — R${i.item.purchasePrice}` : "";
    return `  - ${i.expression.name}${price}`;
  });
  return ["WISHLIST:", ...lines].join("\n");
}

export function buildRatingsBlock(items: CollectionViewItem[]): string {
  const rated = items.filter(i => i.item.status === "owned" && i.item.rating !== undefined);
  const lines = rated.map(i => {
    const stars = "★".repeat(i.item.rating ?? 0) + "☆".repeat(3 - (i.item.rating ?? 0));
    const favStr = i.item.isFavorite ? " ★ FAVORITE" : "";
    return `  - ${i.expression.name}: ${stars}${favStr}`;
  });
  return ["MY BOTTLE RATINGS:", ...lines].join("\n");
}

export function buildBottleDetailBlock(query: string, items: CollectionViewItem[]): string {
  const q = query.toLowerCase();
  const match = items.find(i =>
    i.expression.name.toLowerCase().includes(q) ||
    (i.expression.distilleryName ?? "").toLowerCase().includes(q)
  );
  if (!match) return "";
  const e = match.expression;
  return [
    `BOTTLE DETAIL: ${e.name}`,
    e.distilleryName ? `Distillery: ${e.distilleryName}` : "",
    e.country ? `Country: ${e.country}` : "",
    e.abv ? `ABV: ${e.abv}%` : "",
    e.ageStatement ? `Age: ${e.ageStatement} years` : "",
    e.tags.length ? `Tags: ${e.tags.join(", ")}` : "",
    `Status: ${match.item.status}, ${match.item.fillState}`,
    match.item.rating ? `Rating: ${match.item.rating}/3${match.item.isFavorite ? " (favorite)" : ""}` : "Not rated yet"
  ].filter(Boolean).join("\n");
}

export function buildFullBottleContextBlock(item: CollectionViewItem): string {
  const e = item.expression;
  const tags = e.tags ?? [];

  const lines = [
    `CURRENT BOTTLE CONTEXT (user is viewing this bottle right now):`,
    `Name: ${e.name}`,
    e.brand ? `Brand: ${e.brand}` : null,
    e.distilleryName ? `Distillery: ${e.distilleryName}` : null,
    e.bottlerName ? `Bottler: ${e.bottlerName}` : null,
    e.country ? `Country: ${e.country}` : null,
    e.abv ? `ABV: ${e.abv}%` : null,
    e.ageStatement ? `Age: ${e.ageStatement} years` : null,
    tags.length ? `Tags: ${tags.join(", ")}` : null,
    e.description ? `Description: ${e.description}` : null,
    `Status: ${item.item.status}, ${item.item.fillState}`,
    item.item.purchasePrice ? `Purchase price: ${item.item.purchasePrice} ${item.item.purchaseCurrency ?? ""}`.trim() : null,
    item.item.purchaseSource ? `Purchased from: ${item.item.purchaseSource}` : null,
    item.item.personalNotes ? `Personal notes: ${item.item.personalNotes}` : null,
    item.item.rating
      ? `Rating: ${item.item.rating}/3${item.item.isFavorite ? " (marked as favorite)" : ""}`
      : "Rating: not rated yet"
  ].filter(Boolean);

  return lines.join("\n");
}

export function buildDealsContextBlock(
  specials: NewsFeedItem[],
  newArrivals: NewsFeedItem[],
  fetchedAt: string | null,
  preferences: NewsBudgetPreferences
): string {
  const dateStr = fetchedAt ? new Date(fetchedAt).toLocaleDateString("en-ZA") : "unknown date";
  const budgetLine = preferences.stretchBudgetCapZar !== null
    ? `Budget: up to R${preferences.softBudgetCapZar} normally, stretch to R${preferences.stretchBudgetCapZar}`
    : `Budget: up to R${preferences.softBudgetCapZar} (no fixed stretch ceiling)`;

  const top5Specials = [...specials]
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 5)
    .map(i => {
      const discount = i.discountPct ? ` (-${i.discountPct}%)` : "";
      const badge = i.budgetFit === "in_budget" ? " [in budget]" : ` [${i.budgetFit.replace("_", " ")}]`;
      const reason = i.whyItMatters ? ` — ${i.whyItMatters}` : "";
      return `  - ${i.name} at R${i.price}${discount}${badge} — ${i.source}${reason}`;
    });

  const top5Arrivals = [...newArrivals]
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 5)
    .map(i => {
      const badge = i.budgetFit === "in_budget" ? " [in budget]" : ` [${i.budgetFit.replace("_", " ")}]`;
      const reason = i.whyItMatters ? ` — ${i.whyItMatters}` : "";
      return `  - ${i.name} at R${i.price}${badge} — ${i.source}${reason}`;
    });

  return [
    `CURRENT DEALS & NEW RELEASES (as of ${dateStr}):`,
    budgetLine,
    "Specials:",
    ...top5Specials,
    "New arrivals:",
    ...top5Arrivals
  ].join("\n");
}

export function buildRecentTastingSessionsBlock(sessions: TastingSessionView[]): string {
  if (sessions.length === 0) {
    return "RECENT SOCIAL SESSIONS:\n  - No tasting sessions logged yet.";
  }

  const lines = sessions.slice(0, 6).map((view) => {
    const attendees = view.attendees.map((entry) => entry.name).join(", ") || "solo";
    const bottles = view.bottles.map((entry) => entry.expression.name).join(", ") || "no bottles";
    const context = [view.group?.name, view.place?.name].filter(Boolean).join(" / ");
    const contextSuffix = context ? ` at ${context}` : "";

    return `  - ${view.session.sessionDate}: ${bottles} with ${attendees}${contextSuffix}`;
  });

  return ["RECENT SOCIAL SESSIONS:", ...lines].join("\n");
}

export function buildNeglectedSharedBottlesBlock(items: CollectionViewItem[]): string {
  if (items.length === 0) {
    return "NEGLECTED SHAREABLE BOTTLES:\n  - None available.";
  }

  return [
    "NEGLECTED SHAREABLE BOTTLES:",
    ...items.slice(0, 6).map((item) => `  - ${item.expression.name} [${item.item.fillState}]`)
  ].join("\n");
}

export function buildNamedTargetHistoryBlock(history: {
  people: Array<{ name: string; preferenceTags: string[] }>;
  groups: Array<{ name: string }>;
  places: Array<{ name: string }>;
  preferenceTags: string[];
  recentSessions: TastingSessionView[];
  recentBottles: CollectionViewItem[];
  neverTastedBottles: CollectionViewItem[];
}) {
  const labels = [
    ...history.people.map((entry) => entry.name),
    ...history.groups.map((entry) => entry.name),
    ...history.places.map((entry) => entry.name)
  ];
  const recentBottleNames = history.recentBottles
    .slice(0, 6)
    .map((entry) => entry.expression.name)
    .join(", ");
  const neverTastedNames = history.neverTastedBottles
    .slice(0, 6)
    .map((entry) => entry.expression.name)
    .join(", ");
  const recentSessionLines = history.recentSessions.slice(0, 4).map((view) => {
    const bottles = view.bottles.map((entry) => entry.expression.name).join(", ") || "no bottles";
    return `  - ${view.session.sessionDate}: ${bottles}`;
  });

  return [
    `NAMED SOCIAL TARGETS: ${labels.join(", ") || "none"}`,
    history.preferenceTags.length > 0
      ? `Preference tags: ${history.preferenceTags.join(", ")}`
      : "Preference tags: none saved",
    recentBottleNames
      ? `Recently shared with them: ${recentBottleNames}`
      : "Recently shared with them: nothing logged yet",
    neverTastedNames
      ? `Owned bottles they have not had yet: ${neverTastedNames}`
      : "Owned bottles they have not had yet: none obvious",
    "Recent target sessions:",
    ...recentSessionLines
  ].join("\n");
}
