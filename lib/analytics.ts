import type { CollectionAnalytics, CollectionViewItem, PeatLevel } from "@/lib/types";
import { convertToZar } from "@/lib/currency";
import { sum } from "@/lib/utils";

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((accumulator, value) => {
    accumulator[value] = (accumulator[value] ?? 0) + 1;
    return accumulator;
  }, {});
}

export function buildCollectionAnalytics(items: CollectionViewItem[]): CollectionAnalytics {
  const ownedItems = items.filter(({ item }) => item.status === "owned");
  const tastingEntries = ownedItems.flatMap(({ tastingEntries: entries }) => entries);
  const regionCounts = countBy(ownedItems.map(({ expression }) => expression.region));
  const peatCounts = countBy(ownedItems.map(({ expression }) => expression.peatLevel as PeatLevel));
  const distilleryCounts = countBy(ownedItems.map(({ distillery }) => distillery.name));
  const bottlerCounts = countBy(ownedItems.map(({ bottler }) => bottler.name));
  const ratings = countBy(tastingEntries.map((entry) => String(entry.rating)));

  const paidTotalZar = sum(
    ownedItems.map(({ item }) => {
      if (!item.purchasePrice) {
        return 0;
      }

      return convertToZar(item.purchasePrice, item.purchaseCurrency);
    })
  );

  return {
    totals: {
      owned: items.filter(({ item }) => item.status === "owned").length,
      wishlist: items.filter(({ item }) => item.status === "wishlist").length,
      open: items.filter(({ item }) => item.fillState === "open").length,
      sealed: items.filter(({ item }) => item.fillState === "sealed").length,
      finished: items.filter(({ item }) => item.fillState === "finished").length
    },
    ratingDistribution: [1, 2, 3, 4, 5].map((rating) => ({
      rating,
      count: ratings[String(rating)] ?? 0
    })),
    regionSplit: Object.entries(regionCounts)
      .map(([region, count]) => ({ region, count }))
      .sort((left, right) => right.count - left.count),
    peatProfile: Object.entries(peatCounts)
      .map(([peatLevel, count]) => ({
        peatLevel: peatLevel as PeatLevel,
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
      paidTotalZar,
      marketLowZar: sum(ownedItems.map(({ priceSnapshot }) => priceSnapshot?.retail?.lowZar ?? 0)),
      marketHighZar: sum(ownedItems.map(({ priceSnapshot }) => priceSnapshot?.retail?.highZar ?? 0))
    }
  };
}
