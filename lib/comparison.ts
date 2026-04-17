import type { CollectionViewItem, ComparisonResult } from "@/lib/types";
import {
  getPeatTag,
  getCaskStyleTags,
  isNas,
  isChillFiltered,
  isNaturalColour,
  isLimited,
  isIndependentBottler
} from "@/lib/tags";

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
      rating: left.item.rating
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
      rating: right.item.rating
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
        label: "Tasting notes",
        left: left.expression.tastingNotes.join(", ") || "Not set",
        right: right.expression.tastingNotes.join(", ") || "Not set"
      },
      {
        label: "Rating",
        left: left.item.rating ? `${left.item.rating}/3${left.item.isFavorite ? " ★" : ""}` : "Not rated",
        right: right.item.rating ? `${right.item.rating}/3${right.item.isFavorite ? " ★" : ""}` : "Not rated"
      }
    ],
    summary: `${left.expression.name} leans more ${left.expression.tastingNotes.slice(0, 2).join(" and ") || "toward its structural style"}, while ${right.expression.name} brings more ${right.expression.tastingNotes.slice(0, 2).join(" and ") || "of its own house style"}.`,
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
