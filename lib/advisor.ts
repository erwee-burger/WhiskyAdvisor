import type { AdvisorSuggestion, CollectionViewItem, PalateProfile } from "@/lib/types";
import { clamp } from "@/lib/utils";
import { getCaskStyleTags, getPeatTag } from "@/lib/tags";

function scoreMatch(item: CollectionViewItem, profile: PalateProfile) {
  let score = 55;

  if (profile.favoredRegions.includes(item.expression.country ?? "")) {
    score += 10;
  }

  const caskStyles = getCaskStyleTags(item.expression.tags);
  if (caskStyles.some((cask) => profile.favoredCaskStyles.includes(cask))) {
    score += 10;
  }

  if (getPeatTag(item.expression.tags) === profile.favoredPeatTag) {
    score += 10;
  }

  const tagMatches = (item.expression.tastingNotes ?? []).filter((tag) =>
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
  const peatLine = profile.favoredPeatTag
    ? `Your profile currently leans ${profile.favoredPeatTag}.`
    : "I still need tasting notes before I can infer a peat preference.";
  const regionLine =
    profile.favoredRegions.includes(item.expression.country ?? "") && profile.favoredRegions.length > 0
      ? `You tend to rate ${item.expression.country} whiskies highly.`
      : `It broadens your shelf without leaving your comfort zone.`;
  const tagLine =
    tags.length > 0
      ? `Flavor overlap: ${tags.slice(0, 3).join(", ")}.`
      : profile.favoredFlavorTags.length > 0
        ? `The cask and texture profile match your recent favorites.`
        : `There are not enough tasting notes yet to compare flavor patterns.`;

  const phrases = [
    peatLine,
    regionLine,
    tagLine
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
