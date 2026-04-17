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
      KNOWN_CASK_TYPE_TAGS.includes(tag)
  );
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
