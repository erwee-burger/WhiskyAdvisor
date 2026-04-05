import type { AdvisorSuggestion, CollectionViewItem, PalateProfile } from "@/lib/types";
import { clamp } from "@/lib/utils";

function scoreMatch(item: CollectionViewItem, profile: PalateProfile) {
  let score = 55;

  if (profile.favoredRegions.includes(item.expression.region)) {
    score += 10;
  }

  if (profile.favoredCaskStyles.includes(item.expression.caskInfluence)) {
    score += 10;
  }

  if (item.expression.peatLevel === profile.favoredPeatLevel) {
    score += 10;
  }

  const tagMatches = item.expression.flavorTags.filter((tag) =>
    profile.favoredFlavorTags.includes(tag)
  );
  score += tagMatches.length * 4;

  if (item.item.fillState === "open") {
    score += 6;
  }

  if (item.item.status === "wishlist") {
    score -= 2;
  }

  return {
    score: clamp(score, 0, 100),
    tagMatches
  };
}

function makeReason(item: CollectionViewItem, profile: PalateProfile, tags: string[]) {
  const phrases = [
    `Your profile currently leans ${profile.favoredPeatLevel}.`,
    profile.favoredRegions.includes(item.expression.region)
      ? `You tend to rate ${item.expression.region} whiskies highly.`
      : `It broadens your shelf without leaving your comfort zone.`,
    tags.length > 0
      ? `Flavor overlap: ${tags.slice(0, 3).join(", ")}.`
      : `The cask and texture profile match your recent favorites.`
  ];

  return phrases.join(" ");
}

function buildSuggestions(
  items: CollectionViewItem[],
  profile: PalateProfile,
  filter: (item: CollectionViewItem) => boolean
) {
  return items
    .filter(filter)
    .map<AdvisorSuggestion>((entry) => {
      const match = scoreMatch(entry, profile);
      return {
        itemId: entry.item.id,
        expressionId: entry.expression.id,
        title: entry.expression.name,
        score: match.score,
        rationale: makeReason(entry, profile, match.tagMatches),
        supportingTags: match.tagMatches
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);
}

export function buildDrinkNowSuggestions(items: CollectionViewItem[], profile: PalateProfile) {
  return buildSuggestions(
    items,
    profile,
    ({ item }) => item.status === "owned" && item.fillState !== "finished"
  );
}

export function buildBuyNextSuggestions(items: CollectionViewItem[], profile: PalateProfile) {
  return buildSuggestions(items, profile, ({ item }) => item.status === "wishlist");
}
