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

export class TagGenerator {
  static generate(args: { facts?: ExpressionFacts | null; abv?: number | null }) {
    const tags = new Set<string>();
    const facts = args.facts ?? {};

    includeStructuralTag(tags, facts.whiskyType);

    if (facts.peatLevel) {
      includeStructuralTag(tags, facts.peatLevel);
    }

    for (const influence of facts.caskInfluences ?? []) {
      includeStructuralTag(tags, influence, "-cask");
    }

    includeStructuralTag(tags, facts.caskType);

    for (const finish of facts.finishes ?? []) {
      includeStructuralTag(tags, finish, "-finish");
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
