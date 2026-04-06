import type { ScoredNewsItem } from "@/lib/types";

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
