type ExpressionFacts = {
  whiskyType?: string | null;
  peatLevel?: string | null;
  caskInfluences?: string[] | null;
  caskType?: string | null;
  finishes?: string[] | null;
  bottlerKind?: string | null;
  isNas?: boolean | null;
  isChillFiltered?: boolean | null;
  isNaturalColor?: boolean | null;
  isLimited?: boolean | null;
  isCaskStrength?: boolean | null;
  releaseSeries?: string | null;
};

const FLAVOR_DENYLIST = new Set([
  "fig",
  "smoke",
  "smoky",
  "vanilla",
  "pepper",
  "oily",
  "honey",
  "citrus",
  "leather",
  "toffee",
  "caramel",
  "chocolate",
  "apple",
  "orange",
  "orange-peel",
  "dried-fruit",
  "fruit",
  "spice",
  "spicy",
  "ash",
  "malt",
  "malty",
  "brine",
  "coastal",
  "iodine",
  "berry",
  "jam",
  "walnut",
  "apricot",
  "sea-salt"
]);

const CASK_STYLE_PATTERNS: Array<{ tag: string; patterns: string[] }> = [
  { tag: "bourbon-cask", patterns: ["bourbon"] },
  { tag: "sherry-cask", patterns: ["sherry", "oloroso", "px", "pedro-ximenez", "amontillado", "fino", "manzanilla"] },
  { tag: "wine-cask", patterns: ["wine", "port", "madeira", "marsala", "sauternes"] },
  { tag: "rum-cask", patterns: ["rum"] },
  { tag: "virgin-oak", patterns: ["virgin-oak", "virgin oak", "new oak"] },
  { tag: "mizunara", patterns: ["mizunara"] },
  { tag: "refill-cask", patterns: ["refill"] }
];

const CASK_DETAIL_PATTERNS: Array<{ tag: string; patterns: string[] }> = [
  { tag: "first-fill", patterns: ["first-fill", "first fill"] },
  { tag: "second-fill", patterns: ["second-fill", "second fill"] },
  { tag: "refill", patterns: ["refill"] },
  { tag: "oloroso", patterns: ["oloroso"] },
  { tag: "px", patterns: ["px", "pedro-ximenez", "pedro ximenez"] },
  { tag: "amontillado", patterns: ["amontillado"] },
  { tag: "fino", patterns: ["fino"] },
  { tag: "manzanilla", patterns: ["manzanilla"] },
  { tag: "port", patterns: ["port"] },
  { tag: "madeira", patterns: ["madeira"] },
  { tag: "marsala", patterns: ["marsala"] },
  { tag: "sauternes", patterns: ["sauternes"] },
  { tag: "barrel", patterns: ["barrel"] },
  { tag: "hogshead", patterns: ["hogshead"] },
  { tag: "butt", patterns: ["butt"] },
  { tag: "puncheon", patterns: ["puncheon"] }
];

function normalizeToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function includeStructuralTag(tags: Set<string>, rawValue?: string | null, suffix?: string) {
  if (!rawValue) return;
  const normalized = normalizeToken(rawValue);
  if (!normalized || FLAVOR_DENYLIST.has(normalized)) return;
  tags.add(suffix ? `${normalized}${suffix}` : normalized);
}

function includesPattern(normalized: string, patterns: string[]) {
  return patterns.some((pattern) => normalized.includes(normalizeToken(pattern)));
}

function includeCaskTags(tags: Set<string>, rawValue?: string | null) {
  if (!rawValue) return;

  const normalized = normalizeToken(rawValue);
  if (!normalized) return;

  let matched = false;

  for (const entry of CASK_STYLE_PATTERNS) {
    if (!includesPattern(normalized, entry.patterns)) continue;
    tags.add(entry.tag);
    matched = true;
  }

  for (const entry of CASK_DETAIL_PATTERNS) {
    if (!includesPattern(normalized, entry.patterns)) continue;
    tags.add(entry.tag);
    matched = true;
  }

  if (!matched && !FLAVOR_DENYLIST.has(normalized)) {
    tags.add(`${normalized}-cask`);
  }
}

export class TagGenerator {
  static generate(args: { facts?: ExpressionFacts | null; abv?: number | null }) {
    const tags = new Set<string>();
    const facts = args.facts ?? {};

    includeStructuralTag(tags, facts.whiskyType);

    if (facts.peatLevel) {
      includeStructuralTag(tags, facts.peatLevel);
    }

    for (const influence of facts.caskInfluences ?? []) {
      includeCaskTags(tags, influence);
    }

    includeCaskTags(tags, facts.caskType);

    for (const finish of facts.finishes ?? []) {
      includeCaskTags(tags, finish);
    }

    if (facts.isNas) tags.add("nas");
    if (facts.isChillFiltered === true) tags.add("chill-filtered");
    if (facts.isChillFiltered === false) tags.add("non-chill-filtered");
    if (facts.isNaturalColor) tags.add("natural-colour");
    if (facts.isLimited) tags.add("limited");
    if (facts.bottlerKind === "independent") tags.add("independent-bottler");
    if (facts.releaseSeries) includeStructuralTag(tags, facts.releaseSeries);
    if (facts.isCaskStrength || (typeof args.abv === "number" && args.abv >= 55)) {
      tags.add("cask-strength");
    }

    return [...tags].sort();
  }
}

export type { ExpressionFacts };
