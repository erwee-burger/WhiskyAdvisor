import type { CollectionViewItem, ComparisonResult } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

function displayCurrentPrice(item: CollectionViewItem) {
  const range = item.priceSnapshot?.retail ?? item.priceSnapshot?.auction;
  if (!range) {
    return "No web price yet";
  }

  if (range.low === range.high) {
    return formatCurrency(range.low, range.currency);
  }

  return `${formatCurrency(range.low, range.currency)} - ${formatCurrency(range.high, range.currency)}`;
}

export function buildComparison(left: CollectionViewItem, right: CollectionViewItem): ComparisonResult {
  return {
    left: {
      title: "Left bottle",
      expressionId: left.expression.id,
      displayName: left.expression.name,
      brand: left.expression.brand,
      distillery: left.distillery.name,
      bottler: left.bottler.name,
      releaseSeries: left.expression.releaseSeries,
      ageStatement: left.expression.ageStatement,
      volumeMl: left.expression.volumeMl,
      isNas: left.expression.isNas,
      isChillFiltered: left.expression.isChillFiltered,
      isNaturalColor: left.expression.isNaturalColor,
      isLimited: left.expression.isLimited,
      priceSnapshot: left.priceSnapshot,
      latestTasting: left.latestTasting,
      flavorTags: left.expression.flavorTags
    },
    right: {
      title: "Right bottle",
      expressionId: right.expression.id,
      displayName: right.expression.name,
      brand: right.expression.brand,
      distillery: right.distillery.name,
      bottler: right.bottler.name,
      releaseSeries: right.expression.releaseSeries,
      ageStatement: right.expression.ageStatement,
      volumeMl: right.expression.volumeMl,
      isNas: right.expression.isNas,
      isChillFiltered: right.expression.isChillFiltered,
      isNaturalColor: right.expression.isNaturalColor,
      isLimited: right.expression.isLimited,
      priceSnapshot: right.priceSnapshot,
      latestTasting: right.latestTasting,
      flavorTags: right.expression.flavorTags
    },
    rows: [
      { label: "Brand", left: left.expression.brand ?? "Not set", right: right.expression.brand ?? "Not set" },
      { label: "Distillery", left: left.distillery.name, right: right.distillery.name },
      {
        label: "Bottler",
        left: `${left.bottler.name} (${left.expression.bottlerKind})`,
        right: `${right.bottler.name} (${right.expression.bottlerKind})`
      },
      {
        label: "Release series",
        left: left.expression.releaseSeries ?? "Standard release",
        right: right.expression.releaseSeries ?? "Standard release"
      },
      {
        label: "Age statement",
        left: left.expression.ageStatement?.toString() ?? (left.expression.isNas ? "NAS" : "Not set"),
        right: right.expression.ageStatement?.toString() ?? (right.expression.isNas ? "NAS" : "Not set")
      },
      {
        label: "Bottle size",
        left: left.expression.volumeMl ? `${left.expression.volumeMl} ml` : "Not set",
        right: right.expression.volumeMl ? `${right.expression.volumeMl} ml` : "Not set"
      },
      { label: "ABV", left: `${left.expression.abv}%`, right: `${right.expression.abv}%` },
      {
        label: "Cask",
        left: left.expression.caskType ?? left.expression.caskInfluence,
        right: right.expression.caskType ?? right.expression.caskInfluence
      },
      { label: "Peat level", left: left.expression.peatLevel, right: right.expression.peatLevel },
      {
        label: "NAS",
        left: left.expression.isNas ? "Yes" : "No",
        right: right.expression.isNas ? "Yes" : "No"
      },
      {
        label: "Chill filtered",
        left: left.expression.isChillFiltered ? "Yes" : "No",
        right: right.expression.isChillFiltered ? "Yes" : "No"
      },
      {
        label: "Natural color",
        left: left.expression.isNaturalColor ? "Yes" : "No",
        right: right.expression.isNaturalColor ? "Yes" : "No"
      },
      {
        label: "Limited",
        left: left.expression.isLimited ? "Yes" : "No",
        right: right.expression.isLimited ? "Yes" : "No"
      },
      {
        label: "Flavor tags",
        left: left.expression.flavorTags.join(", "),
        right: right.expression.flavorTags.join(", ")
      },
      {
        label: "Current web price",
        left: displayCurrentPrice(left),
        right: displayCurrentPrice(right)
      },
      {
        label: "Latest rating",
        left: left.latestTasting ? `${left.latestTasting.rating}/5` : "Not rated",
        right: right.latestTasting ? `${right.latestTasting.rating}/5` : "Not rated"
      }
    ],
    summary: `${left.expression.name} leans more ${left.expression.flavorTags.slice(0, 2).join(" and ")}, while ${right.expression.name} brings more ${right.expression.flavorTags.slice(0, 2).join(" and ")}.`,
    palateFit: {
      left:
        left.expression.peatLevel === "heavily-peated"
          ? "Best when you want a bold, smoky pour."
          : "Best when you want a richer or more rounded dram.",
      right:
        right.expression.caskInfluence === "sherry"
          ? "Best when you want dense fruit and cask weight."
          : "Best when you want brightness, freshness, or balance."
    }
  };
}
