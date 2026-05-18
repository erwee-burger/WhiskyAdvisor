import type { CollectionViewItem, PalateProfile } from "@/lib/types";
import { getCaskStyleTags, getPeatTag } from "@/lib/tags";

function averageMap(sums: Map<string, number>, counts: Map<string, number>): Map<string, number> {
  const avgs = new Map<string, number>();
  for (const [key, sum] of sums) {
    avgs.set(key, sum / (counts.get(key) ?? 1));
  }
  return avgs;
}

function topEntries(map: Map<string, number>, limit = 3) {
  return [...map.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([key]) => key);
}

export function buildPalateProfile(items: CollectionViewItem[]): PalateProfile {
  const flavorSums = new Map<string, number>();
  const flavorCounts = new Map<string, number>();
  const regionSums = new Map<string, number>();
  const regionCounts = new Map<string, number>();
  const caskSums = new Map<string, number>();
  const caskCounts = new Map<string, number>();
  const peatSums = new Map<string, number>();
  const peatCounts = new Map<string, number>();

  // Only rated bottles carry preference signal
  const ratedItems = items.filter((entry) => entry.item.rating !== undefined);
  const hasSignals = ratedItems.length > 0;

  for (const entry of ratedItems) {
    const rating = entry.item.rating!;
    // Favorites get a small lift to separate standouts within the same rating tier,
    // capped so they can't exceed the scale ceiling
    const effectiveRating = entry.item.isFavorite ? Math.min(rating + 0.5, 3) : rating;

    for (const note of entry.expression.tastingNotes ?? []) {
      flavorSums.set(note, (flavorSums.get(note) ?? 0) + effectiveRating);
      flavorCounts.set(note, (flavorCounts.get(note) ?? 0) + 1);
    }

    const region = entry.expression.country ?? "";
    regionSums.set(region, (regionSums.get(region) ?? 0) + effectiveRating);
    regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);

    for (const caskTag of getCaskStyleTags(entry.expression.tags)) {
      caskSums.set(caskTag, (caskSums.get(caskTag) ?? 0) + effectiveRating);
      caskCounts.set(caskTag, (caskCounts.get(caskTag) ?? 0) + 1);
    }

    const peatTag = getPeatTag(entry.expression.tags);
    if (peatTag) {
      peatSums.set(peatTag, (peatSums.get(peatTag) ?? 0) + effectiveRating);
      peatCounts.set(peatTag, (peatCounts.get(peatTag) ?? 0) + 1);
    }
  }

  const regionAvgs = averageMap(regionSums, regionCounts);
  const caskAvgs = averageMap(caskSums, caskCounts);
  const flavorAvgs = averageMap(flavorSums, flavorCounts);
  const peatAvgs = averageMap(peatSums, peatCounts);

  const favoredPeatTag = hasSignals
    ? [...peatAvgs.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null
    : null;

  return {
    cards: [
      {
        title: "Peat comfort zone",
        value: favoredPeatTag ?? "No data yet",
        supporting: hasSignals
          ? "Averaged from your rated bottles — ownership alone doesn't count."
          : "Rate a few bottles and the app will start inferring this."
      },
      {
        title: "Regional lean",
        value: hasSignals ? topEntries(regionAvgs, 1)[0] ?? "Still learning" : "No data yet",
        supporting: hasSignals
          ? "The region you rate most highly on average."
          : "Regional preferences appear once you rate a few bottles."
      },
      {
        title: "Cask bias",
        value: hasSignals ? topEntries(caskAvgs, 1)[0] ?? "Mixed" : "No data yet",
        supporting: hasSignals
          ? "The cask style you rate most highly on average."
          : "Cask preferences appear after you rate some bottles."
      },
      {
        title: "Signature notes",
        value: hasSignals ? topEntries(flavorAvgs, 3).join(", ") || "No notes yet" : "No data yet",
        supporting: hasSignals
          ? "Tasting notes that keep surfacing in your highest-rated bottles."
          : "Flavor patterns appear after you rate a few bottles."
      }
    ],
    favoredFlavorTags: topEntries(flavorAvgs, 5),
    favoredRegions: topEntries(regionAvgs, 3),
    favoredCaskStyles: topEntries(caskAvgs, 3),
    favoredPeatTag
  };
}
