import type { NewsAffinity, NewsFeedItem, PalateProfile } from "@/lib/types";
import { clamp } from "@/lib/utils";

type Signal = {
  label: string;
  score: number;
};

type AliasGroup = {
  label: string;
  aliases: string[];
};

const FLAVOR_GROUPS: AliasGroup[] = [
  { label: "Smoke notes", aliases: ["smoke", "smoky", "peat", "peated", "ash", "char", "ember", "soot", "iodine"] },
  { label: "Maritime notes", aliases: ["brine", "saline", "salt", "coastal", "maritime", "sea", "oyster"] },
  { label: "Citrus notes", aliases: ["citrus", "lemon", "orange", "grapefruit", "lime"] },
  { label: "Orchard fruit", aliases: ["apple", "pear", "orchard"] },
  { label: "Dried-fruit notes", aliases: ["raisin", "sultana", "fig", "date", "dried fruit"] },
  { label: "Honeyed sweetness", aliases: ["honey", "toffee", "caramel", "syrup", "vanilla"] },
  { label: "Spice notes", aliases: ["spice", "pepper", "ginger", "clove", "cinnamon", "nutmeg"] },
  { label: "Chocolate notes", aliases: ["chocolate", "cocoa", "espresso", "coffee", "mocha"] },
  { label: "Malty texture", aliases: ["malt", "biscuit", "cereal", "bread", "nutty"] },
  { label: "Floral lift", aliases: ["floral", "flower", "heather", "herbal", "grass"] },
  { label: "Oak structure", aliases: ["oak", "oaky", "wood", "tannin", "leather"] }
];

const REGION_ALIASES: Record<string, string[]> = {
  scotland: ["scotland", "scotch", "islay", "speyside", "highland", "campbeltown", "lowland"],
  ireland: ["ireland", "irish"],
  japan: ["japan", "japanese"],
  usa: ["usa", "u.s.a", "united states", "american", "kentucky", "tennessee", "bourbon", "rye"],
  america: ["america", "american", "kentucky", "tennessee", "bourbon", "rye"],
  taiwan: ["taiwan", "taiwanese"],
  india: ["india", "indian"],
  "south africa": ["south africa", "south african"]
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function includesAny(text: string, candidates: string[]): boolean {
  return candidates.some((candidate) => text.includes(normalize(candidate)));
}

function uniqueSignals(signals: Signal[]): string[] {
  return signals
    .sort((left, right) => right.score - left.score)
    .map((signal) => signal.label)
    .filter((label, index, values) => values.indexOf(label) === index)
    .slice(0, 2);
}

function flavorGroupFor(note: string): AliasGroup {
  const normalized = normalize(note);
  return FLAVOR_GROUPS.find((group) => group.aliases.some((alias) => normalized.includes(alias))) ?? {
    label: note.length <= 24 ? note : `${note.slice(0, 21).trim()}...`,
    aliases: [note]
  };
}

function caskSignalFor(style: string): AliasGroup {
  switch (style) {
    case "sherry-cask":
      return { label: "Sherry cask lane", aliases: ["sherry", "oloroso", "px", "pedro ximenez", "amontillado"] };
    case "bourbon-cask":
      return { label: "Bourbon cask lane", aliases: ["bourbon", "ex bourbon", "vanilla oak"] };
    case "wine-cask":
      return { label: "Wine cask lane", aliases: ["wine cask", "wine finish", "sauternes", "port", "madeira"] };
    case "rum-cask":
      return { label: "Rum cask lane", aliases: ["rum cask", "rum finish", "molasses", "rum"] };
    case "virgin-oak":
      return { label: "Virgin oak lane", aliases: ["virgin oak", "new oak"] };
    case "refill-cask":
      return { label: "Refill cask lane", aliases: ["refill", "refill cask"] };
    default:
      return { label: style, aliases: [style] };
  }
}

function peatSignalFor(peatTag: string): AliasGroup | null {
  switch (peatTag) {
    case "peated":
      return { label: "Peated comfort zone", aliases: ["peated", "peat", "smoke", "smoky", "islay"] };
    case "heavily-peated":
      return {
        label: "Heavy peat comfort zone",
        aliases: ["heavily peated", "peat monster", "octomore", "laphroaig", "ardbeg", "lagavulin", "smoke bomb"]
      };
    case "unpeated":
      return { label: "Unpeated lane", aliases: ["unpeated"] };
    default:
      return null;
  }
}

function regionSignalFor(region: string): AliasGroup {
  const normalized = normalize(region);
  return {
    label: `${region} lane`,
    aliases: REGION_ALIASES[normalized] ?? [region]
  };
}

export function hasMeaningfulNewsProfile(profile: PalateProfile | null): boolean {
  if (!profile) return false;
  return (
    profile.favoredFlavorTags.length > 0 ||
    profile.favoredCaskStyles.length > 0 ||
    profile.favoredRegions.length > 0 ||
    Boolean(profile.favoredPeatTag)
  );
}

export function getNewsAffinity(item: NewsFeedItem, profile: PalateProfile | null): NewsAffinity | null {
  if (!hasMeaningfulNewsProfile(profile)) {
    return null;
  }

  const text = normalize(
    [item.name, item.whyItMatters ?? "", item.kind === "special" ? "special" : "new release"].join(" ")
  );
  const signals: Signal[] = [];
  let score = 55;

  for (const note of profile!.favoredFlavorTags) {
    const group = flavorGroupFor(note);
    if (includesAny(text, group.aliases)) {
      score += 8;
      signals.push({ label: group.label, score: 8 });
    }
  }

  for (const caskStyle of profile!.favoredCaskStyles) {
    const signal = caskSignalFor(caskStyle);
    if (includesAny(text, signal.aliases)) {
      score += 12;
      signals.push({ label: signal.label, score: 12 });
    }
  }

  if (profile!.favoredPeatTag) {
    const signal = peatSignalFor(profile!.favoredPeatTag);
    if (signal && includesAny(text, signal.aliases)) {
      const weight = profile!.favoredPeatTag === "heavily-peated" ? 14 : 10;
      score += weight;
      signals.push({ label: signal.label, score: weight });
    }
  }

  for (const region of profile!.favoredRegions) {
    const signal = regionSignalFor(region);
    if (includesAny(text, signal.aliases)) {
      score += 7;
      signals.push({ label: signal.label, score: 7 });
    }
  }

  const boundedScore = clamp(score, 55, 95);
  const band =
    boundedScore >= 75 ? "strong_fit" : boundedScore >= 65 ? "good_fit" : "outside_usual_lane";

  return {
    score: boundedScore,
    band,
    reasons: uniqueSignals(signals)
  };
}
