import type { CollectionViewItem, PalateProfile, PeatLevel } from "@/lib/types";

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
  const peatScores = new Map<PeatLevel, number>();

  for (const entry of items) {
    const average =
      entry.tastingEntries.reduce((sum, tasting) => sum + tasting.rating, 0) /
        (entry.tastingEntries.length || 1) || 0;
    const weight = average || 3;

    for (const tag of entry.expression.flavorTags) {
      flavorScores.set(tag, (flavorScores.get(tag) ?? 0) + weight);
    }

    regionScores.set(
      entry.expression.region,
      (regionScores.get(entry.expression.region) ?? 0) + weight
    );
    caskScores.set(
      entry.expression.caskInfluence,
      (caskScores.get(entry.expression.caskInfluence) ?? 0) + weight
    );
    peatScores.set(
      entry.expression.peatLevel,
      (peatScores.get(entry.expression.peatLevel) ?? 0) + weight
    );
  }

  const favoredPeatLevel =
    [...peatScores.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "medium";

  return {
    cards: [
      {
        title: "Peat comfort zone",
        value: favoredPeatLevel,
        supporting: "Weighted from your highest-rated pours."
      },
      {
        title: "Regional lean",
        value: topEntries(regionScores, 1)[0] ?? "Still learning",
        supporting: "Based on your saved notes and recent ratings."
      },
      {
        title: "Cask bias",
        value: topEntries(caskScores, 1)[0] ?? "Mixed",
        supporting: "The cask styles that currently suit your palate best."
      },
      {
        title: "Signature notes",
        value: topEntries(flavorScores, 3).join(", ") || "No notes yet",
        supporting: "Descriptors that keep surfacing in bottles you rate highly."
      }
    ],
    favoredFlavorTags: topEntries(flavorScores, 5),
    favoredRegions: topEntries(regionScores, 3),
    favoredCaskStyles: topEntries(caskScores, 3),
    favoredPeatLevel
  };
}
