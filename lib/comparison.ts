import type { CollectionViewItem, ComparisonResult } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import {
  getPeatTag,
  getCaskStyleTags,
  isNas,
  isChillFiltered,
  isNaturalColour,
  isLimited,
  isIndependentBottler
} from "@/lib/tags";

function displayCurrentPrice(item: CollectionViewItem) {
  return "No web price yet";
}

export function buildComparison(left: CollectionViewItem, right: CollectionViewItem): ComparisonResult {
  return {
    left: {
      title: "Left bottle",
      expressionId: left.expression.id,
      displayName: left.expression.name,
      brand: left.expression.brand,
      distilleryName: left.expression.distilleryName ?? "Unknown",
      bottlerName: left.expression.bottlerName ?? "Unknown",
      ageStatement: left.expression.ageStatement,
      abv: left.expression.abv,
      tags: left.expression.tags,
      latestTasting: left.latestTasting
    },
    right: {
      title: "Right bottle",
      expressionId: right.expression.id,
      displayName: right.expression.name,
      brand: right.expression.brand,
      distilleryName: right.expression.distilleryName ?? "Unknown",
      bottlerName: right.expression.bottlerName ?? "Unknown",
      ageStatement: right.expression.ageStatement,
      abv: right.expression.abv,
      tags: right.expression.tags,
      latestTasting: right.latestTasting
    },
    rows: [
      { label: "Brand", left: left.expression.brand ?? "Not set", right: right.expression.brand ?? "Not set" },
      { label: "Distillery", left: left.expression.distilleryName ?? "Unknown", right: right.expression.distilleryName ?? "Unknown" },
      {
        label: "Bottler",
        left: `${left.expression.bottlerName ?? "Unknown"} (${isIndependentBottler(left.expression.tags) ? "Independent" : "Official"})`,
        right: `${right.expression.bottlerName ?? "Unknown"} (${isIndependentBottler(right.expression.tags) ? "Independent" : "Official"})`
      },
      {
        label: "Age statement",
        left: left.expression.ageStatement?.toString() ?? (isNas(left.expression.tags) ? "NAS" : "Not set"),
        right: right.expression.ageStatement?.toString() ?? (isNas(right.expression.tags) ? "NAS" : "Not set")
      },
      { label: "ABV", left: left.expression.abv ? `${left.expression.abv}%` : "Not set", right: right.expression.abv ? `${right.expression.abv}%` : "Not set" },
      {
        label: "Cask",
        left: getCaskStyleTags(left.expression.tags).join(", ") || "Not specified",
        right: getCaskStyleTags(right.expression.tags).join(", ") || "Not specified"
      },
      { label: "Peat level", left: getPeatTag(left.expression.tags) ?? "Unknown", right: getPeatTag(right.expression.tags) ?? "Unknown" },
      {
        label: "NAS",
        left: isNas(left.expression.tags) ? "Yes" : "No",
        right: isNas(right.expression.tags) ? "Yes" : "No"
      },
      {
        label: "Chill filtered",
        left: isChillFiltered(left.expression.tags) ? "Yes" : "No",
        right: isChillFiltered(right.expression.tags) ? "Yes" : "No"
      },
      {
        label: "Natural color",
        left: isNaturalColour(left.expression.tags) ? "Yes" : "No",
        right: isNaturalColour(right.expression.tags) ? "Yes" : "No"
      },
      {
        label: "Limited",
        left: isLimited(left.expression.tags) ? "Yes" : "No",
        right: isLimited(right.expression.tags) ? "Yes" : "No"
      },
      {
        label: "Flavor tags",
        left: left.expression.tags.join(", "),
        right: right.expression.tags.join(", ")
      },
      {
        label: "Latest rating",
        left: left.latestTasting ? `${left.latestTasting.rating}/5` : "Not rated",
        right: right.latestTasting ? `${right.latestTasting.rating}/5` : "Not rated"
      }
    ],
    summary: `${left.expression.name} leans more ${left.expression.tags.slice(0, 2).join(" and ")}, while ${right.expression.name} brings more ${right.expression.tags.slice(0, 2).join(" and ")}.`,
    palateFit: {
      left:
        getPeatTag(left.expression.tags) === "heavily-peated"
          ? "Best when you want a bold, smoky pour."
          : "Best when you want a richer or more rounded dram.",
      right:
        getCaskStyleTags(right.expression.tags).includes("sherry-cask")
          ? "Best when you want dense fruit and cask weight."
          : "Best when you want brightness, freshness, or balance."
    }
  };
}
