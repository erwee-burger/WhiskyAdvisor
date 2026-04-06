import type { CollectionAnalytics, CollectionViewItem } from "@/lib/types";
import { convertToZar } from "@/lib/currency";
import { sum } from "@/lib/utils";
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

export function buildCollectionAnalytics(items: CollectionViewItem[]): CollectionAnalytics {
  const ownedItems = items.filter(({ item }) => item.status === "owned");
  const tastingEntries = ownedItems.flatMap(({ tastingEntries: entries }) => entries);
  const regionCounts = countBy(ownedItems.map(({ expression }) => expression.country ?? "Unknown").filter((c): c is string => Boolean(c)));
  const peatTags = ownedItems.map(({ expression }) => getPeatTag(expression.tags) ?? "unspecified");
  const peatCounts = countBy(peatTags as string[]);
  const distilleryCounts = countBy(ownedItems.map(({ expression }) => expression.distilleryName ?? "Unknown").filter((d): d is string => Boolean(d)));
  const bottlerCounts = countBy(ownedItems.map(({ expression }) => expression.bottlerName ?? "Unknown").filter((b): b is string => Boolean(b)));
  const ratings = countBy(tastingEntries.map((entry) => String(entry.rating)));

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
    ratingDistribution: [1, 2, 3, 4, 5].map((rating) => ({
      rating,
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
      .slice(0, 5)
  };
}
