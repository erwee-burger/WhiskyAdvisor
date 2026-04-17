// lib/tags.ts

/** Returns true if the expression's tags include the given tag */
export function hasTag(tags: string[], tag: string): boolean {
  return tags.includes(tag);
}

/** Returns tags that start with the given prefix, stripping the prefix */
export function tagsWithPrefix(tags: string[], prefix: string): string[] {
  return tags.filter((t) => t.startsWith(prefix));
}

/** Returns the first tag matching any of the given candidates, or undefined */
export function firstMatchingTag(tags: string[], candidates: string[]): string | undefined {
  return tags.find((t) => candidates.includes(t));
}

const PEAT_TAGS = ["unpeated", "peated", "heavily-peated"];
const RECOGNIZED_CASK_STYLE_TAGS = [
  "bourbon-cask",
  "sherry-cask",
  "wine-cask",
  "rum-cask",
  "virgin-oak",
  "refill-cask"
];
const KNOWN_CASK_TYPE_TAGS = ["px", "amontillado", "oloroso", "mizunara", "virgin-oak", "refill-cask"];
const KNOWN_CASK_DETAIL_TAGS = [
  "first-fill",
  "second-fill",
  "refill",
  "barrel",
  "hogshead",
  "butt",
  "puncheon"
];

const TAG_LABELS: Record<string, string> = {
  nas: "NAS",
  "cask-strength": "Cask strength",
  "natural-colour": "Natural colour",
  "non-chill-filtered": "Non-chill filtered",
  "chill-filtered": "Chill filtered",
  "independent-bottler": "Independent bottler",
  "single-malt": "Single malt",
  "single-grain": "Single grain",
  "blended-malt": "Blended malt",
  "blended-scotch": "Blended Scotch",
  "bourbon-cask": "Bourbon cask",
  "sherry-cask": "Sherry cask",
  "wine-cask": "Wine cask",
  "rum-cask": "Rum cask",
  "virgin-oak": "Virgin oak"
};

export function getPeatTag(tags: string[]): string | null {
  return tags.find((t) => PEAT_TAGS.includes(t)) ?? null;
}

export function getCaskStyleTags(tags: string[]): string[] {
  return tags.filter((t) => RECOGNIZED_CASK_STYLE_TAGS.includes(t));
}

export function getAllCaskTags(tags: string[]): string[] {
  return tags.filter(
    (tag) =>
      tag.endsWith("-cask") ||
      tag.endsWith("-finish") ||
      KNOWN_CASK_TYPE_TAGS.includes(tag) ||
      KNOWN_CASK_DETAIL_TAGS.includes(tag)
  );
}

export function formatTagLabel(tag: string): string {
  if (TAG_LABELS[tag]) {
    return TAG_LABELS[tag];
  }

  return tag
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function isNas(tags: string[]): boolean {
  return tags.includes("nas");
}

export function isLimited(tags: string[]): boolean {
  return tags.includes("limited");
}

export function isChillFiltered(tags: string[]): boolean {
  return tags.includes("chill-filtered");
}

export function isNaturalColour(tags: string[]): boolean {
  return tags.includes("natural-colour");
}

export function isIndependentBottler(tags: string[]): boolean {
  return tags.includes("independent-bottler");
}
