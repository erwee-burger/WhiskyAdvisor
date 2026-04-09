import type { CollectionAnalytics, CollectionViewItem } from "@/lib/types";
import { convertToZar } from "@/lib/currency";
import {
  getPeatTag,
  isNas,
  isLimited,
  isChillFiltered,
  isNaturalColour
} from "@/lib/tags";

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((accumulator, value) => {
    accumulator[value] = (accumulator[value] ?? 0) + 1;
    return accumulator;
  }, {});
}

const RATING_LABELS: Record<number, string> = {
  1: "Don't like it",
  2: "Good / neutral",
  3: "Like it"
};

export function buildCollectionAnalytics(items: CollectionViewItem[]): CollectionAnalytics {
  const ownedItems = items.filter(({ item }) => item.status === "owned");
  const regionCounts = countBy(ownedItems.map(({ expression }) => expression.country ?? "Unknown").filter((c): c is string => Boolean(c)));
  const peatTags = ownedItems.map(({ expression }) => getPeatTag(expression.tags) ?? "unspecified");
  const peatCounts = countBy(peatTags as string[]);
  const distilleryCounts = countBy(ownedItems.map(({ expression }) => expression.distilleryName).filter((d): d is string => Boolean(d)));
  const bottlerCounts = countBy(ownedItems.map(({ expression }) => expression.bottlerName).filter((b): b is string => Boolean(b)));
  const ratings = countBy(ownedItems.filter(({ item }) => item.rating).map(({ item }) => String(item.rating)));
  const volumeEntries = ownedItems
    .map(({ expression }) => expression.volumeMl)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const paidTotal = ownedItems.reduce(
    (sumValue, entry) => sumValue + convertToZar(entry.item.purchasePrice ?? 0, entry.item.purchaseCurrency ?? "ZAR"),
    0
  );
  const marketLow = paidTotal;
  const marketHigh = paidTotal;

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
      naturalColor: ownedItems.filter(({ expression }) => isNaturalColour(expression.tags)).length,
      averageVolumeMl: volumeEntries.length > 0 ? Math.round(volumeEntries.reduce((sumValue, value) => sumValue + value, 0) / volumeEntries.length) : null,
      withVolume: volumeEntries.length
    },
    ratingDistribution: [1, 2, 3].map((rating) => ({
      rating,
      label: RATING_LABELS[rating],
      count: ratings[String(rating)] ?? 0
    })),
    regionSplit: Object.entries(regionCounts)
      .map(([region, count]) => ({ region, count }))
      .sort((left, right) => right.count - left.count),
    peatProfile: Object.entries(peatCounts)
      .map(([tag, count]) => ({
        tag,
        count
      }))
      .sort((left, right) => right.count - left.count),
    topDistilleries: Object.entries(distilleryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5),
    topBottlers: Object.entries(bottlerCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5),
    marketValue: {
      paidTotalZar: paidTotal,
      marketLowZar: marketLow,
      marketHighZar: marketHigh
    }
  };
}
