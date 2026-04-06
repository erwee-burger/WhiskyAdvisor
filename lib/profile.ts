import type { CollectionViewItem, PalateProfile } from "@/lib/types";
import { getCaskStyleTags, getPeatTag } from "@/lib/tags";

function topEntries(map: Map<string, number>, limit = 3) {
  return [...map.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([key]) => key);
}

export function buildPalateProfile(items: CollectionViewItem[]): PalateProfile {
  const flavorScores = new Map<string, number>();
  const regionScores = new Map<string, number>();
  const caskScores = new Map<string, number>();
  const peatScores = new Map<string, number>();
  const hasSignals = items.some((entry) => entry.tastingEntries.length > 0);

  for (const entry of items) {
    const average =
      entry.tastingEntries.reduce((sum, tasting) => sum + tasting.rating, 0) /
        (entry.tastingEntries.length || 1) || 0;
    const weight = average || 3;

    for (const tag of entry.expression.tags) {
      flavorScores.set(tag, (flavorScores.get(tag) ?? 0) + weight);
    }

    regionScores.set(
      entry.expression.country ?? "",
      (regionScores.get(entry.expression.country ?? "") ?? 0) + weight
    );
    const caskTags = getCaskStyleTags(entry.expression.tags);
    for (const caskTag of caskTags) {
      caskScores.set(caskTag, (caskScores.get(caskTag) ?? 0) + weight);
    }
    const peatTag = getPeatTag(entry.expression.tags);
    if (peatTag) {
      peatScores.set(peatTag, (peatScores.get(peatTag) ?? 0) + weight);
    }
  }

  const favoredPeatTag = hasSignals
    ? [...peatScores.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null
    : null;

  return {
    cards: [
      {
        title: "Peat comfort zone",
        value: favoredPeatTag ?? "No data yet",
        supporting: hasSignals
          ? "Weighted from your highest-rated pours."
          : "Add tasting notes before the app starts inferring this."
      },
      {
        title: "Regional lean",
        value: hasSignals ? topEntries(regionScores, 1)[0] ?? "Still learning" : "No data yet",
        supporting: hasSignals
          ? "Based on your saved notes and recent ratings."
          : "Regional preferences appear once you rate a few drams."
      },
      {
        title: "Cask bias",
        value: hasSignals ? topEntries(caskScores, 1)[0] ?? "Mixed" : "No data yet",
        supporting: hasSignals
          ? "The cask styles that currently suit your palate best."
          : "Cask preferences appear after confirmed tastings."
      },
      {
        title: "Signature notes",
        value: hasSignals ? topEntries(flavorScores, 3).join(", ") || "No notes yet" : "No data yet",
        supporting: hasSignals
          ? "Descriptors that keep surfacing in bottles you rate highly."
          : "Flavor patterns appear after you save tasting notes."
      }
    ],
    favoredFlavorTags: topEntries(flavorScores, 5),
    favoredRegions: topEntries(regionScores, 3),
    favoredCaskStyles: topEntries(caskScores, 3),
    favoredPeatTag
  };
}
