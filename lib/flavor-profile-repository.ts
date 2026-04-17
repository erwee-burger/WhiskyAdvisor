import { createId } from "@/lib/id";
import type { Expression, ExpressionFlavorProfile, FlavorPillar, WhiskyStore } from "@/lib/types";
import { getCaskStyleTags, getPeatTag } from "@/lib/tags";

const PILLARS: FlavorPillar[] = [
  "smoky",
  "sweet",
  "spicy",
  "fruity",
  "oaky",
  "floral",
  "malty",
  "coastal"
];

const NOTE_WEIGHTS: Array<{ pillar: FlavorPillar; matches: string[] }> = [
  { pillar: "smoky", matches: ["smoke", "smoky", "peat", "ash", "char", "bbq", "barbecue", "iodine"] },
  { pillar: "sweet", matches: ["vanilla", "honey", "caramel", "toffee", "chocolate", "jam", "syrup"] },
  { pillar: "spicy", matches: ["pepper", "spice", "ginger", "clove", "cinnamon"] },
  { pillar: "fruity", matches: ["fruit", "apple", "orange", "lemon", "berry", "apricot", "raisin"] },
  { pillar: "oaky", matches: ["oak", "wood", "tannin", "walnut", "leather"] },
  { pillar: "floral", matches: ["floral", "flower", "perfume", "heather"] },
  { pillar: "malty", matches: ["malt", "biscuit", "bread", "cereal", "nutty"] },
  { pillar: "coastal", matches: ["coastal", "brine", "salt", "sea", "maritime"] }
];

function emptyPillars() {
  return {
    smoky: 0,
    sweet: 0,
    spicy: 0,
    fruity: 0,
    oaky: 0,
    floral: 0,
    malty: 0,
    coastal: 0
  } satisfies Record<FlavorPillar, number>;
}

function normalizeNote(note: string) {
  return note.trim().toLowerCase();
}

function scoreFromNote(note: string, pillars: Record<FlavorPillar, number>) {
  const normalized = normalizeNote(note);
  for (const weight of NOTE_WEIGHTS) {
    if (weight.matches.some((token) => normalized.includes(token))) {
      pillars[weight.pillar] += 1;
    }
  }
}

function applyMetadataPriors(expression: Expression, pillars: Record<FlavorPillar, number>) {
  const peat = getPeatTag(expression.tags);
  if (peat === "peated") pillars.smoky += 1;
  if (peat === "heavily-peated") pillars.smoky += 2;

  const casks = getCaskStyleTags(expression.tags);
  if (casks.includes("sherry-cask")) {
    pillars.fruity += 1;
    pillars.sweet += 1;
  }
  if (casks.includes("bourbon-cask")) {
    pillars.sweet += 1;
    pillars.oaky += 1;
  }
  if (casks.includes("wine-cask")) {
    pillars.fruity += 1;
  }
  if (casks.includes("rum-cask")) {
    pillars.sweet += 1;
    pillars.spicy += 1;
  }
  if (typeof expression.abv === "number" && expression.abv >= 55) {
    pillars.spicy += 1;
  }
  if (typeof expression.ageStatement === "number" && expression.ageStatement >= 15) {
    pillars.oaky += 1;
  }
}

function normalizePillars(pillars: Record<FlavorPillar, number>) {
  const max = Math.max(1, ...Object.values(pillars));
  return Object.fromEntries(
    PILLARS.map((pillar) => [pillar, Math.min(10, Math.round((pillars[pillar] / max) * 10))])
  ) as Record<FlavorPillar, number>;
}

export function classifyExpressionFlavor(expression: Expression): Omit<ExpressionFlavorProfile, "id" | "createdAt" | "updatedAt"> {
  const rawPillars = emptyPillars();
  const notes = expression.tastingNotes ?? [];

  for (const note of notes) {
    scoreFromNote(note, rawPillars);
  }

  applyMetadataPriors(expression, rawPillars);

  const evidenceCount = notes.length;
  const topNotes = [...notes].slice(0, 5);
  const confidence = Math.max(
    0.25,
    Math.min(0.95, 0.35 + evidenceCount * 0.08 + (expression.description ? 0.06 : 0))
  );
  const now = new Date().toISOString();

  return {
    expressionId: expression.id,
    pillars: normalizePillars(rawPillars),
    topNotes,
    confidence: Number(confidence.toFixed(2)),
    evidenceCount,
    explanation:
      topNotes.length > 0
        ? `Built from tasting notes (${topNotes.slice(0, 3).join(", ")}) with bounded metadata priors.`
        : "Built from structural metadata only, so confidence is reduced.",
    scoringVersion: "v1",
    modelVersion: "deterministic-v1",
    generatedAt: now,
    staleAt: undefined
  };
}

export function saveExpressionFlavorProfile(store: WhiskyStore, expression: Expression) {
  const classification = classifyExpressionFlavor(expression);
  const existingIndex = store.expressionFlavorProfiles.findIndex(
    (entry) => entry.expressionId === expression.id
  );

  if (existingIndex >= 0) {
    const existing = store.expressionFlavorProfiles[existingIndex];
    store.expressionFlavorProfiles[existingIndex] = {
      ...existing,
      ...classification,
      updatedAt: new Date().toISOString()
    };
    return store.expressionFlavorProfiles[existingIndex];
  }

  const createdAt = new Date().toISOString();
  const profile: ExpressionFlavorProfile = {
    id: createId("expr_flavor"),
    ...classification,
    createdAt,
    updatedAt: createdAt
  };
  store.expressionFlavorProfiles.unshift(profile);
  return profile;
}

export function markExpressionFlavorProfileStale(store: WhiskyStore, expressionId: string) {
  const index = store.expressionFlavorProfiles.findIndex((entry) => entry.expressionId === expressionId);
  if (index < 0) {
    return;
  }

  store.expressionFlavorProfiles[index] = {
    ...store.expressionFlavorProfiles[index],
    staleAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}
