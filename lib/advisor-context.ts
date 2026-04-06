import type { CollectionViewItem, PalateProfile, AdvisorSuggestion, TastingEntry, ScoredNewsItem } from "@/lib/types";
import { buildCollectionAnalytics } from "@/lib/analytics";

export interface ContextTriggers {
  drinkNow: boolean;
  wishlist: boolean;
  analytics: boolean;
  tastings: boolean;
  deals: boolean;
  bottleName: string | null;
}

export function detectContextTriggers(query: string): ContextTriggers {
  const q = query.toLowerCase();

  const drinkNow = /open tonight|drink now|what should i have|what should i open|pour tonight/.test(q);
  const wishlist = /buy next|next purchase|wishlist|should i get|worth (it|buying)/.test(q);
  const analytics = /how many|collection stats|analytics|how much|total|count/.test(q);
  const tastings = /tasting note|my notes|rating|rated|my review/.test(q);
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

  return { drinkNow, wishlist, analytics, tastings, deals, bottleName };
}

export function buildCollectionSummary(items: CollectionViewItem[]): string {
  const analytics = buildCollectionAnalytics(items);
  const topRegions = analytics.regionSplit.slice(0, 3).map(r => r.region).join(", ");
  const topDistilleries = analytics.distillerySplit?.slice(0, 3).map((d: { distillery: string }) => d.distillery).join(", ") ?? "";

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
    profile.favoredFlavorTags.length ? `Top flavor tags: ${profile.favoredFlavorTags.join(", ")}` : "Flavor tags: none yet"
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
    const rating = i.latestTasting ? ` (rated ${i.latestTasting.rating}/5)` : "";
    return `  - ${i.expression.name}${rating} [${i.item.fillState}]`;
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

export function buildTastingsBlock(tastings: TastingEntry[], items: CollectionViewItem[]): string {
  const recent = tastings.slice(0, 10);
  const lines = recent.map(t => {
    const item = items.find(i => i.item.id === t.collectionItemId);
    const name = item?.expression.name ?? "Unknown";
    return `  - ${name} (${t.rating}/5): nose: ${t.nose}; palate: ${t.palate}; finish: ${t.finish}`;
  });
  return ["RECENT TASTING NOTES:", ...lines].join("\n");
}

export function buildBottleDetailBlock(query: string, items: CollectionViewItem[]): string {
  const q = query.toLowerCase();
  const match = items.find(i =>
    i.expression.name.toLowerCase().includes(q) ||
    (i.expression.distilleryName ?? "").toLowerCase().includes(q)
  );
  if (!match) return "";
  const e = match.expression;
  const t = match.latestTasting;
  return [
    `BOTTLE DETAIL: ${e.name}`,
    e.distilleryName ? `Distillery: ${e.distilleryName}` : "",
    e.country ? `Country: ${e.country}` : "",
    e.region ? `Region: ${e.region}` : "",
    e.abv ? `ABV: ${e.abv}%` : "",
    e.ageStatement ? `Age: ${e.ageStatement} years` : "",
    e.caskType ? `Cask: ${e.caskType}` : "",
    e.tags.length ? `Tags: ${e.tags.join(", ")}` : "",
    `Status: ${match.item.status}, ${match.item.fillState}`,
    t ? `Latest tasting (${t.rating}/5): ${t.overallNote}` : "No tasting notes yet"
  ].filter(Boolean).join("\n");
}

export function buildDealsContextBlock(
  specials: ScoredNewsItem[],
  newReleases: ScoredNewsItem[],
  fetchedAt: string | null
): string {
  const dateStr = fetchedAt ? new Date(fetchedAt).toLocaleDateString("en-ZA") : "unknown date";
  const top5Specials = [...specials]
    .sort((a, b) => b.palateScore - a.palateScore)
    .slice(0, 5)
    .map(i => `  - ${i.name} at R${i.price}${i.discountPct ? ` (-${i.discountPct}%)` : ""} — ${i.source}`);
  const top5Releases = [...newReleases]
    .sort((a, b) => b.palateScore - a.palateScore)
    .slice(0, 5)
    .map(i => `  - ${i.name} at R${i.price} — ${i.source}`);

  return [
    `CURRENT DEALS & NEW RELEASES (as of ${dateStr}):`,
    "Specials:",
    ...top5Specials,
    "New arrivals:",
    ...top5Releases
  ].join("\n");
}

export function buildFullDealsBlock(specials: ScoredNewsItem[]): string {
  const lines = specials.map(i =>
    `  - ${i.name} at R${i.price}${i.discountPct ? ` (-${i.discountPct}%)` : ""} [palate match: ${i.palateScore}] — ${i.source} (${i.url})`
  );
  return ["ALL CURRENT SPECIALS:", ...lines].join("\n");
}

export function buildFullReleasesBlock(releases: ScoredNewsItem[]): string {
  const lines = releases.map(i =>
    `  - ${i.name} at R${i.price} [palate match: ${i.palateScore}] — ${i.source} (${i.url})`
  );
  return ["ALL NEW RELEASES:", ...lines].join("\n");
}
