import { convertToZar } from "@/lib/currency";
import { formatTagLabel, getCaskStyleTags, getPeatTag, isChillFiltered, isIndependentBottler, isLimited, isNas, isNaturalColour } from "@/lib/tags";
import type { CollectionAnalytics, CollectionViewItem, FlavorPillar } from "@/lib/types";

const PILLARS: FlavorPillar[] = ["smoky", "sweet", "spicy", "fruity", "oaky", "floral", "malty", "coastal"];

const RATING_LABELS: Record<number, string> = {
  1: "Don't like it",
  2: "Good / neutral",
  3: "Like it"
};

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((accumulator, value) => {
    accumulator[value] = (accumulator[value] ?? 0) + 1;
    return accumulator;
  }, {});
}

function compactDefined(values: Array<string | null | undefined>) {
  return values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value): value is string => value.length > 0);
}

function toSortedCounts<T extends string>(
  values: T[],
  mapEntry: (name: string, count: number) => { [key: string]: string | number }
) {
  return Object.entries(countBy(values))
    .map(([name, count]) => mapEntry(name, count))
    .sort((left, right) => Number(right.count) - Number(left.count));
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function percentage(count: number, total: number) {
  if (total <= 0) return 0;
  return round((count / total) * 100, 1);
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return round((sorted[middle - 1] + sorted[middle]) / 2, 2);
  }
  return round(sorted[middle], 2);
}

function emptyPillars() {
  return {
    smoky: 0,
    sweet: 0,
    spicy: 0,
    fruity: 0,
    oaky: 0,
    floral: 0,
    malty: 0,
    coastal: 0
  } satisfies Record<FlavorPillar, number>;
}

function formatPillarLabel(pillar: FlavorPillar) {
  return pillar === "oaky" ? "oak" : pillar;
}

function buildDominantSummary({
  strongestPillars,
  ownedItems,
  caskStyles
}: {
  strongestPillars: Array<{ pillar: FlavorPillar; value: number }>;
  ownedItems: CollectionViewItem[];
  caskStyles: Array<{ tag: string; label: string; count: number; share: number }>;
}) {
  const topPillars = strongestPillars.slice(0, 2).map(({ pillar }) => formatPillarLabel(pillar));
  const descriptors: string[] = [];

  if (topPillars.length > 0) {
    descriptors.push(topPillars.join("-leaning"));
  }

  if (ownedItems.filter((entry) => isIndependentBottler(entry.expression.tags)).length >= Math.ceil(ownedItems.length / 3)) {
    descriptors.push("IB-heavy");
  }

  if (caskStyles[0]?.tag === "sherry-cask") {
    descriptors.push("sherry-curious");
  } else if (caskStyles[0]?.tag === "bourbon-cask") {
    descriptors.push("bourbon-led");
  }

  if (descriptors.length === 0) {
    return "Your shelf is still broad enough that no one style fully dominates.";
  }

  return `Your shelf skews ${descriptors.join(", ")}.`;
}

export function buildCollectionAnalytics(items: CollectionViewItem[]): CollectionAnalytics {
  const ownedItems = items.filter(({ item }) => item.status === "owned");
  const ratedOwnedItems = ownedItems.filter(({ item }) => typeof item.rating === "number");
  const favoriteOwnedItems = ownedItems.filter(({ item }) => item.isFavorite === true);
  const highlyRatedOwnedItems = ownedItems.filter(({ item }) => item.rating === 3 || item.isFavorite === true);
  const pricedOwnedValues = ownedItems
    .filter(({ item }) => typeof item.purchasePrice === "number")
    .map(({ item }) => convertToZar(item.purchasePrice ?? 0, item.purchaseCurrency ?? "ZAR"));
  const paidTotal = round(pricedOwnedValues.reduce((sumValue, value) => sumValue + value, 0), 2);
  const knownRegions = compactDefined(ownedItems.map(({ expression }) => expression.country));
  const knownDistilleries = compactDefined(ownedItems.map(({ expression }) => expression.distilleryName));
  const knownBottlers = compactDefined(ownedItems.map(({ expression }) => expression.bottlerName));

  const regionSplit = toSortedCounts(
    knownRegions,
    (region, count) => ({ region, count })
  ) as Array<{ region: string; count: number }>;

  const peatProfile = toSortedCounts(
    ownedItems.map(({ expression }) => getPeatTag(expression.tags) ?? "unspecified"),
    (tag, count) => ({ tag, count })
  ) as Array<{ tag: string; count: number; peatLevel?: string }>;

  const topDistilleries = toSortedCounts(
    knownDistilleries,
    (name, count) => ({ name, count })
  ).slice(0, 5) as Array<{ name: string; count: number }>;

  const topBottlers = toSortedCounts(
    knownBottlers,
    (name, count) => ({ name, count })
  ).slice(0, 5) as Array<{ name: string; count: number }>;

  const flavorProfiles = ownedItems
    .map((entry) => entry.flavorProfile)
    .filter((entry): entry is NonNullable<CollectionViewItem["flavorProfile"]> => Boolean(entry));
  const pillarTotals = emptyPillars();
  const noteCounts: Record<string, number> = {};

  for (const profile of flavorProfiles) {
    for (const pillar of PILLARS) {
      pillarTotals[pillar] += profile.pillars[pillar];
    }

    for (const note of profile.topNotes) {
      const normalized = note.trim().toLowerCase();
      if (!normalized) continue;
      noteCounts[normalized] = (noteCounts[normalized] ?? 0) + 1;
    }
  }

  const pillarAverages = Object.fromEntries(
    PILLARS.map((pillar) => [pillar, flavorProfiles.length > 0 ? round(pillarTotals[pillar] / flavorProfiles.length, 1) : 0])
  ) as Record<FlavorPillar, number>;

  const strongestPillars = [...PILLARS]
    .map((pillar) => ({ pillar, value: pillarAverages[pillar] }))
    .sort((left, right) => right.value - left.value);
  const weakestPillars = [...strongestPillars].reverse();

  const topNotes = Object.entries(noteCounts)
    .map(([note, count]) => ({ note, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);

  const caskStyles = toSortedCounts(
    ownedItems.flatMap(({ expression }) => getCaskStyleTags(expression.tags)),
    (tag, count) => ({
      tag,
      label: formatTagLabel(tag),
      count,
      share: percentage(count, ownedItems.length)
    })
  ) as Array<{ tag: string; label: string; count: number; share: number }>;

  const peatLevels = peatProfile.map((entry) => ({
    tag: entry.tag,
    label: entry.tag === "unspecified" ? "Unspecified" : formatTagLabel(entry.tag),
    count: entry.count,
    share: percentage(entry.count, ownedItems.length)
  }));

  const independentCount = ownedItems.filter(({ expression }) => isIndependentBottler(expression.tags)).length;
  const officialCount = Math.max(0, ownedItems.length - independentCount);
  const topRegionShare = percentage(regionSplit[0]?.count ?? 0, knownRegions.length);
  const topDistilleryShare = percentage(topDistilleries[0]?.count ?? 0, knownDistilleries.length);
  const averageRating =
    ratedOwnedItems.length > 0
      ? round(ratedOwnedItems.reduce((total, { item }) => total + (item.rating ?? 0), 0) / ratedOwnedItems.length, 2)
      : null;
  const favoriteRate =
    ratedOwnedItems.length > 0 ? percentage(favoriteOwnedItems.length, ratedOwnedItems.length) : 0;
  const topRatedRegions = toSortedCounts(
    compactDefined(highlyRatedOwnedItems.map(({ expression }) => expression.country)),
    (region, count) => ({ region, count })
  ).slice(0, 3) as Array<{ region: string; count: number }>;
  const topRatedCaskStyles = toSortedCounts(
    highlyRatedOwnedItems.flatMap(({ expression }) => getCaskStyleTags(expression.tags)),
    (tag, count) => ({ tag, label: formatTagLabel(tag), count })
  ).slice(0, 3) as Array<{ tag: string; label: string; count: number }>;

  const blindSpots: CollectionAnalytics["blindSpots"] = [];

  if (flavorProfiles.length > 0 && pillarAverages.smoky >= 6 && pillarAverages.floral <= 2.5) {
    blindSpots.push({
      title: "Smoke dominates the shelf",
      detail: "Your profiled bottles lean heavily smoky while floral/light profiles are barely represented.",
      tone: "bias"
    });
  }

  const sherryOwnedCount = ownedItems.filter(({ expression }) => getCaskStyleTags(expression.tags).includes("sherry-cask")).length;
  const sherryHighRatedCount = highlyRatedOwnedItems.filter(({ expression }) => getCaskStyleTags(expression.tags).includes("sherry-cask")).length;
  if (highlyRatedOwnedItems.length >= 2 && sherryHighRatedCount >= Math.ceil(highlyRatedOwnedItems.length / 2) && sherryOwnedCount <= Math.max(1, Math.floor(ownedItems.length / 3))) {
    blindSpots.push({
      title: "Rated bottles point toward more sherry",
      detail: "Your highest-rated bottles over-index on sherry casks relative to the shelf you currently own.",
      tone: "opportunity"
    });
  }

  const regionCount = regionSplit.length;
  if (independentCount >= Math.ceil(ownedItems.length / 2) && regionCount > 0 && regionCount <= 2) {
    blindSpots.push({
      title: "Independent bottlers, narrow map",
      detail: "You already lean IB-heavy, but most of the shelf still clusters into very few regions.",
      tone: "gap"
    });
  }

  if (flavorProfiles.length > 0) {
    const weakestMeaningful = weakestPillars.find((entry) => entry.value <= 2.5);
    if (weakestMeaningful) {
      blindSpots.push({
        title: `${formatPillarLabel(weakestMeaningful.pillar)} is underrepresented`,
        detail: `Your profiled shelf has very little ${formatPillarLabel(weakestMeaningful.pillar)} character compared with the rest of the collection.`,
        tone: "gap"
      });
    }
  }

  if (ownedItems.length >= 3 && flavorProfiles.length < ownedItems.length / 2) {
    blindSpots.push({
      title: "Flavor coverage is still thin",
      detail: "Less than half of your owned shelf has saved flavor profiles, so taste-shape insights are directionally useful but not complete yet.",
      tone: "opportunity"
    });
  }

  return {
    totals: {
      owned: items.filter(({ item }) => item.status === "owned").length,
      wishlist: items.filter(({ item }) => item.status === "wishlist").length,
      open: items.filter(({ item }) => item.fillState === "open").length,
      sealed: items.filter(({ item }) => item.fillState === "sealed").length,
      finished: items.filter(({ item }) => item.fillState === "finished").length
    },
    bottleProfile: {
      brandTagged: ownedItems.filter(({ expression }) => Boolean(expression.brand)).length,
      nas: ownedItems.filter(({ expression }) => isNas(expression.tags)).length,
      limited: ownedItems.filter(({ expression }) => isLimited(expression.tags)).length,
      chillFiltered: ownedItems.filter(({ expression }) => isChillFiltered(expression.tags)).length,
      naturalColor: ownedItems.filter(({ expression }) => isNaturalColour(expression.tags)).length
    },
    ratingDistribution: [1, 2, 3].map((rating) => ({
      rating,
      label: RATING_LABELS[rating],
      count: ratedOwnedItems.filter(({ item }) => item.rating === rating).length
    })),
    regionSplit,
    peatProfile,
    topDistilleries,
    topBottlers,
    tasteIdentity: {
      profileCoverage: {
        profiledOwnedCount: flavorProfiles.length,
        totalOwnedCount: ownedItems.length,
        percent: percentage(flavorProfiles.length, ownedItems.length)
      },
      pillarAverages,
      strongestPillars,
      weakestPillars,
      topNotes,
      dominantSummary: buildDominantSummary({
        strongestPillars,
        ownedItems,
        caskStyles
      })
    },
    collectionShape: {
      caskStyles,
      peatLevels,
      independentVsOfficial: {
        independent: independentCount,
        official: officialCount
      },
      regionConcentration: topRegionShare,
      distilleryConcentration: topDistilleryShare,
      topRegionShare,
      topDistilleryShare
    },
    ratingsInsight: {
      ratedCount: ratedOwnedItems.length,
      favoriteCount: favoriteOwnedItems.length,
      favoriteRate,
      averageRating,
      unratedOwnedCount: ownedItems.length - ratedOwnedItems.length,
      topRatedRegions,
      topRatedCaskStyles
    },
    spendInsight: {
      paidTotalZar: paidTotal,
      averageOwnedBottlePriceZar: pricedOwnedValues.length > 0 ? round(paidTotal / pricedOwnedValues.length, 2) : null,
      medianOwnedBottlePriceZar: median(pricedOwnedValues)
    },
    blindSpots: blindSpots.slice(0, 4),
    marketValue: {
      paidTotalZar: paidTotal,
      marketLowZar: paidTotal,
      marketHighZar: paidTotal
    }
  };
}
