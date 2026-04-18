import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const storePath = path.join(__dirname, "../../data/mock-store.json");

const PEAT_TAGS = new Set(["unpeated", "peated", "heavily-peated"]);
const KNOWN_CASK_TYPE_TAGS = new Set([
  "px",
  "amontillado",
  "oloroso",
  "mizunara",
  "virgin-oak",
  "refill-cask",
  "first-fill",
  "second-fill",
  "refill",
  "barrel",
  "hogshead",
  "butt",
  "puncheon"
]);
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
  "sea-salt",
  "barbecue",
  "bbq",
  "lemon",
  "engine-oil",
  "dark-fruit",
  "tropical-fruit"
]);
const NOTE_WEIGHTS = [
  { pillar: "smoky", matches: ["smoke", "smoky", "peat", "ash", "char", "bbq", "barbecue", "iodine"] },
  { pillar: "sweet", matches: ["vanilla", "honey", "caramel", "toffee", "chocolate", "jam", "syrup"] },
  { pillar: "spicy", matches: ["pepper", "spice", "ginger", "clove", "cinnamon"] },
  { pillar: "fruity", matches: ["fruit", "apple", "orange", "lemon", "berry", "apricot", "raisin"] },
  { pillar: "oaky", matches: ["oak", "wood", "tannin", "walnut", "leather"] },
  { pillar: "floral", matches: ["floral", "flower", "perfume", "heather"] },
  { pillar: "malty", matches: ["malt", "biscuit", "bread", "cereal", "nutty"] },
  { pillar: "coastal", matches: ["coastal", "brine", "salt", "sea", "maritime"] }
];
const CASK_STYLE_PATTERNS = [
  { tag: "bourbon-cask", patterns: ["bourbon"] },
  { tag: "sherry-cask", patterns: ["sherry", "oloroso", "px", "pedro-ximenez", "amontillado", "fino", "manzanilla"] },
  { tag: "wine-cask", patterns: ["wine", "port", "madeira", "marsala", "sauternes"] },
  { tag: "rum-cask", patterns: ["rum"] },
  { tag: "virgin-oak", patterns: ["virgin-oak", "virgin oak", "new oak"] },
  { tag: "mizunara", patterns: ["mizunara"] },
  { tag: "refill-cask", patterns: ["refill"] }
];
const CASK_DETAIL_PATTERNS = [
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

export const VALID_MODES = new Set(["all", "missing-flavor-profiles", "stale", "weak-notes"]);
export const MIN_PREFERRED_TASTING_NOTES = 8;
export const MAX_TASTING_NOTES = 15;
export const MIN_RELIABLE_TASTING_NOTES = 6;
export const DEFAULT_MODEL = process.env.OPENAI_ENRICHMENT_MODEL || process.env.OPENAI_MODEL || "gpt-5.4";
export const BATCH_ENDPOINT = "/v1/responses";
export const BATCH_COMPLETION_WINDOW = "24h";
export const BATCH_CUSTOM_ID_PREFIX = "expr-cleanup:";

export function normalizeText(value) {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

export function normalizeNumber(value) {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function normalizeToken(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => typeof entry === "string");
}

export function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function includeStructuralTag(tags, rawValue, suffix = "") {
  if (!rawValue) return;
  const normalized = normalizeToken(rawValue);
  if (!normalized || FLAVOR_DENYLIST.has(normalized)) return;
  tags.add(`${normalized}${suffix}`);
}

function includesPattern(normalized, patterns) {
  return patterns.some((pattern) => normalized.includes(normalizeToken(pattern)));
}

function includeCaskTags(tags, rawValue) {
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

function generateTagsFromFacts(facts, abv) {
  const tags = new Set();
  const source = facts ?? {};

  includeStructuralTag(tags, source.whiskyType);
  includeStructuralTag(tags, source.peatLevel);

  for (const influence of toStringArray(source.caskInfluences)) {
    includeCaskTags(tags, influence);
  }

  includeCaskTags(tags, source.caskType);

  for (const finish of toStringArray(source.finishes)) {
    includeCaskTags(tags, finish);
  }

  if (source.isNas) tags.add("nas");
  if (source.isChillFiltered === true) tags.add("chill-filtered");
  if (source.isChillFiltered === false) tags.add("non-chill-filtered");
  if (source.isNaturalColor) tags.add("natural-colour");
  if (source.isLimited) tags.add("limited");
  if (source.bottlerKind === "independent") tags.add("independent-bottler");
  includeStructuralTag(tags, source.releaseSeries);

  if (source.isCaskStrength || (typeof abv === "number" && abv >= 55)) {
    tags.add("cask-strength");
  }

  return [...tags].sort();
}

function looksStructuralTag(tag) {
  return (
    PEAT_TAGS.has(tag) ||
    tag.endsWith("-cask") ||
    tag.endsWith("-finish") ||
    KNOWN_CASK_TYPE_TAGS.has(tag) ||
    tag === "nas" ||
    tag === "limited" ||
    tag === "natural-colour" ||
    tag === "chill-filtered" ||
    tag === "non-chill-filtered" ||
    tag === "independent-bottler" ||
    tag === "cask-strength" ||
    tag.includes("single-") ||
    tag.includes("blended") ||
    tag.endsWith("-whisky") ||
    tag.endsWith("-whiskey") ||
    /\d{4}-(vintage|distilled|bottled)$/.test(tag) ||
    /^\d+ml$/.test(tag) ||
    /^outturn-\d+$/.test(tag) ||
    /^bottle-\d+$/.test(tag) ||
    /^cask-.+/.test(tag)
  );
}

function fallbackStructuralTags(expression) {
  const tags = uniqueStrings((expression.tags ?? []).map(normalizeToken))
    .filter((tag) => !FLAVOR_DENYLIST.has(tag))
    .filter((tag) => looksStructuralTag(tag) || !tag.includes("-"));

  if ((expression.abv ?? 0) >= 55 && !tags.includes("cask-strength")) {
    tags.push("cask-strength");
  }

  return [...new Set(tags)].sort();
}

function looksLikeFlavorNote(tag) {
  if (FLAVOR_DENYLIST.has(tag)) return true;
  return NOTE_WEIGHTS.some((weight) => weight.matches.some((token) => tag.includes(token)));
}

function salvageTastingNotes(expression) {
  const explicit = uniqueStrings(toStringArray(expression.tastingNotes).map((note) => normalizeText(note))).filter(Boolean);
  if (explicit.length > 0) {
    return explicit.slice(0, MAX_TASTING_NOTES);
  }

  return uniqueStrings(
    toStringArray(expression.tags)
      .map(normalizeToken)
      .filter((tag) => looksLikeFlavorNote(tag))
      .map((tag) => tag.replaceAll("-", " "))
  ).slice(0, MAX_TASTING_NOTES);
}

function scoreTastingNotes(notes) {
  return toStringArray(notes)
    .map((note) => note.trim().toLowerCase())
    .filter(Boolean)
    .reduce((score, note) => {
      const tokens = note.split(/\s+/).filter(Boolean).length;
      const specificityBonus = tokens >= 2 ? 2 : 0;
      const weightedMatchBonus = NOTE_WEIGHTS.some((weight) =>
        weight.matches.some((token) => note.includes(token))
      )
        ? 1
        : 0;
      return score + 1 + specificityBonus + weightedMatchBonus;
    }, 0);
}

function chooseBetterTastingNotes(existingNotes, candidateNotes) {
  const existing = uniqueStrings(toStringArray(existingNotes).map((note) => normalizeText(note)).filter(Boolean));
  const candidate = uniqueStrings(toStringArray(candidateNotes).map((note) => normalizeText(note)).filter(Boolean));

  if (candidate.length === 0) return existing;
  if (existing.length === 0) return candidate.slice(0, MAX_TASTING_NOTES);

  const existingScore = scoreTastingNotes(existing);
  const candidateScore = scoreTastingNotes(candidate);

  if (existing.length >= 6 && candidate.length < existing.length && candidateScore <= existingScore) {
    return existing.slice(0, MAX_TASTING_NOTES);
  }

  if (candidate.length < 6 && existing.length >= candidate.length && existingScore >= candidateScore) {
    return existing.slice(0, MAX_TASTING_NOTES);
  }

  return candidateScore >= existingScore ? candidate.slice(0, MAX_TASTING_NOTES) : existing.slice(0, MAX_TASTING_NOTES);
}

function shouldReplaceIdentityField(existingValue, candidateValue) {
  if (!candidateValue) return false;
  if (!existingValue) return true;
  const existing = String(existingValue).trim();
  const candidate = String(candidateValue).trim();
  if (!candidate || candidate === existing) return false;
  return existing.toLowerCase() === candidate.toLowerCase();
}

function chooseIdentityValue(existingValue, candidateValue) {
  return shouldReplaceIdentityField(existingValue, candidateValue) ? candidateValue : existingValue;
}

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
  };
}

function getPeatTag(tags) {
  return tags.find((tag) => PEAT_TAGS.has(tag)) ?? null;
}

function getCaskStyleTags(tags) {
  return tags.filter((tag) =>
    ["bourbon-cask", "sherry-cask", "wine-cask", "rum-cask", "virgin-oak", "refill-cask"].includes(tag)
  );
}

export function classifyFlavorProfile(expression, previousProfile) {
  const rawPillars = emptyPillars();
  const notes = toStringArray(expression.tastingNotes).map((note) => note.trim().toLowerCase()).filter(Boolean);

  for (const note of notes) {
    for (const weight of NOTE_WEIGHTS) {
      if (weight.matches.some((token) => note.includes(token))) {
        rawPillars[weight.pillar] += 1;
      }
    }
  }

  const peatTag = getPeatTag(expression.tags ?? []);
  if (peatTag === "peated") rawPillars.smoky += 1;
  if (peatTag === "heavily-peated") rawPillars.smoky += 2;

  const caskStyles = getCaskStyleTags(expression.tags ?? []);
  if (caskStyles.includes("sherry-cask")) {
    rawPillars.fruity += 1;
    rawPillars.sweet += 1;
  }
  if (caskStyles.includes("bourbon-cask")) {
    rawPillars.sweet += 1;
    rawPillars.oaky += 1;
  }
  if (caskStyles.includes("wine-cask")) rawPillars.fruity += 1;
  if (caskStyles.includes("rum-cask")) {
    rawPillars.sweet += 1;
    rawPillars.spicy += 1;
  }
  if ((expression.abv ?? 0) >= 55) rawPillars.spicy += 1;
  if ((expression.ageStatement ?? 0) >= 15) rawPillars.oaky += 1;

  const pillars = Object.fromEntries(
    Object.entries(rawPillars).map(([pillar, value]) => [pillar, toAbsolutePillarScore(value)])
  );
  const activePillars = Object.values(pillars).filter((value) => value >= 3).length;
  const evidenceScore = Math.min(0.28, notes.length * 0.028);
  const descriptionScore = expression.description ? 0.04 : 0;
  const diversityScore = Math.min(0.12, activePillars * 0.02);
  const confidence = Math.max(0.24, Math.min(0.82, 0.28 + evidenceScore + descriptionScore + diversityScore));
  const now = new Date().toISOString();

  return {
    id: previousProfile?.id ?? `expr_flavor_${expression.id}`,
    expressionId: expression.id,
    pillars,
    topNotes: notes.slice(0, 5),
    confidence: Number(confidence.toFixed(2)),
    evidenceCount: notes.length,
    explanation:
      notes.length > 0
        ? `Weighted from ${notes.length} tasting notes and bounded structural traits.`
        : "Built from structural metadata only, so confidence is reduced.",
    scoringVersion: "v2",
    modelVersion: "deterministic-v2",
    generatedAt: now,
    staleAt: null,
    createdAt: previousProfile?.createdAt ?? now,
    updatedAt: now
  };
}

function toAbsolutePillarScore(rawScore) {
  if (rawScore <= 0) return 0;
  if (rawScore === 1) return 2;
  if (rawScore === 2) return 4;
  if (rawScore === 3) return 5;
  if (rawScore === 4) return 6;
  if (rawScore === 5) return 7;
  if (rawScore === 6) return 8;
  if (rawScore === 7) return 9;
  return 10;
}

export function buildLookupPrompt(expression) {
  const searchHint = [
    expression.name,
    expression.distilleryName,
    expression.brand,
    expression.bottlerName,
    expression.barcode
  ]
    .filter(Boolean)
    .join(" | ");

  return [
    "You are cleaning a whisky expression record into a canonical expression shape.",
    "Use web search to verify the exact bottle when needed.",
    "Do not guess missing facts. If a field is not well-supported, return null or an empty array.",
    "Current tags are not authoritative source data. Do not copy flavor descriptors into tags.",
    "Tasting-note quality matters more than brevity.",
    `Return ${MIN_PREFERRED_TASTING_NOTES}-${MAX_TASTING_NOTES} tasting notes when reviews, retailer notes, and official notes support them.`,
    "Prefer specific phrases such as charred lemon, waxy malt, sooty smoke, heather honey, grilled peach, toasted almond.",
    "Avoid generic notes like fruit, spice, sweet, oak unless evidence is genuinely sparse.",
    "Do not return fewer than 6 tasting notes unless the evidence is genuinely thin.",
    "Identity fields should only change when the exact bottle variant is clearly supported.",
    "Return only valid JSON.",
    "",
    "Return this exact shape:",
    '{"name":null,"distilleryName":null,"bottlerName":null,"brand":null,"country":null,"abv":null,"ageStatement":null,"barcode":null,"description":null,"tastingNotes":[],"facts":{"whiskyType":null,"peatLevel":null,"caskInfluences":[],"caskType":null,"finishes":[],"bottlerKind":null,"isNas":null,"isChillFiltered":null,"isNaturalColor":null,"isLimited":null,"isCaskStrength":null,"releaseSeries":null}}',
    "",
    "Current record:",
    JSON.stringify(
      {
        name: expression.name,
        distilleryName: expression.distilleryName ?? null,
        bottlerName: expression.bottlerName ?? null,
        brand: expression.brand ?? null,
        country: expression.country ?? null,
        abv: expression.abv ?? null,
        ageStatement: expression.ageStatement ?? null,
        barcode: expression.barcode ?? null,
        description: expression.description ?? null,
        tastingNotes: expression.tastingNotes ?? [],
        tags: expression.tags ?? []
      },
      null,
      2
    ),
    "",
    `Search hint: ${searchHint}`
  ].join("\n");
}

export function buildBatchCustomId(expressionId) {
  return `${BATCH_CUSTOM_ID_PREFIX}${expressionId}`;
}

export function parseBatchCustomId(customId) {
  if (typeof customId !== "string" || !customId.startsWith(BATCH_CUSTOM_ID_PREFIX)) {
    return null;
  }
  return customId.slice(BATCH_CUSTOM_ID_PREFIX.length);
}

export function buildBatchRequestLine(expression, model) {
  return {
    custom_id: buildBatchCustomId(expression.id),
    method: "POST",
    url: BATCH_ENDPOINT,
    body: {
      model,
      reasoning: { effort: "medium" },
      tools: [{ type: "web_search_preview" }],
      input: buildLookupPrompt(expression)
    }
  };
}

export function extractOutputText(payload) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.output)) {
    return "";
  }

  for (let index = payload.output.length - 1; index >= 0; index -= 1) {
    const item = payload.output[index];
    if (item?.type !== "message" || !Array.isArray(item.content)) continue;
    const part = item.content.find((entry) => entry.type === "output_text" && typeof entry.text === "string");
    if (part?.text) return part.text;
  }

  return "";
}

export function extractJson(text) {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

export function parseBatchOutputEntry(entry) {
  const expressionId = parseBatchCustomId(entry?.custom_id);
  const statusCode = entry?.response?.status_code ?? null;
  const body = entry?.response?.body ?? null;
  const rawText = extractOutputText(body);

  return {
    customId: entry?.custom_id ?? null,
    expressionId,
    statusCode,
    body,
    rawText,
    parsed: extractJson(rawText),
    error: entry?.error ?? null
  };
}

export function mergeExpression(existing, enriched) {
  const resolved = enriched ?? {};
  const abv = normalizeNumber(resolved.abv) ?? existing.abv;

  const next = {
    ...existing,
    name: chooseIdentityValue(existing.name, normalizeText(resolved.name) ?? existing.name),
    distilleryName: chooseIdentityValue(existing.distilleryName, normalizeText(resolved.distilleryName)),
    bottlerName: chooseIdentityValue(existing.bottlerName, normalizeText(resolved.bottlerName)),
    brand: chooseIdentityValue(existing.brand, normalizeText(resolved.brand)),
    country: chooseIdentityValue(existing.country, normalizeText(resolved.country)),
    abv,
    ageStatement: normalizeNumber(resolved.ageStatement) ?? existing.ageStatement,
    barcode: chooseIdentityValue(existing.barcode, normalizeText(resolved.barcode)),
    description: normalizeText(resolved.description) ?? existing.description
  };

  const generatedTags =
    resolved.facts && typeof resolved.facts === "object"
      ? generateTagsFromFacts(resolved.facts, abv)
      : fallbackStructuralTags(existing);
  const tastingNotes = uniqueStrings(
    toStringArray(resolved.tastingNotes).map((note) => normalizeText(note)).filter(Boolean)
  ).slice(0, MAX_TASTING_NOTES);

  next.tags = generatedTags;
  next.tastingNotes = chooseBetterTastingNotes(
    salvageTastingNotes(existing),
    tastingNotes.length > 0 ? tastingNotes : salvageTastingNotes(existing)
  );

  return next;
}

export function diffExpression(previous, next) {
  const changed = [];
  for (const key of [
    "name",
    "distilleryName",
    "bottlerName",
    "brand",
    "country",
    "abv",
    "ageStatement",
    "barcode",
    "description"
  ]) {
    if ((previous[key] ?? null) !== (next[key] ?? null)) {
      changed.push(key);
    }
  }

  if (JSON.stringify(previous.tags ?? []) !== JSON.stringify(next.tags ?? [])) {
    changed.push("tags");
  }

  if (JSON.stringify(previous.tastingNotes ?? []) !== JSON.stringify(next.tastingNotes ?? [])) {
    changed.push("tastingNotes");
  }

  return changed;
}

function normalizeMockStore(store) {
  return {
    ...store,
    expressions: Array.isArray(store.expressions)
      ? store.expressions.map((expression) => ({
          ...expression,
          tags: toStringArray(expression.tags),
          tastingNotes: toStringArray(expression.tastingNotes)
        }))
      : [],
    expressionFlavorProfiles: Array.isArray(store.expressionFlavorProfiles)
      ? store.expressionFlavorProfiles
      : []
  };
}

export async function loadSource() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceRoleKey) {
    const supabase = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const [{ data: expressions, error: expressionsError }, { data: profiles, error: profilesError }] =
      await Promise.all([
        supabase.from("expressions").select("*").order("name", { ascending: true }),
        supabase.from("expression_flavor_profiles").select("*")
      ]);

    if (expressionsError) {
      throw new Error(`Failed to fetch expressions: ${expressionsError.message}`);
    }
    if (profilesError) {
      throw new Error(`Failed to fetch expression_flavor_profiles: ${profilesError.message}`);
    }

    return {
      kind: "supabase",
      supabase,
      expressions: (expressions ?? []).map((row) => ({
        id: String(row.id),
        name: String(row.name),
        distilleryName: normalizeText(row.distillery_name),
        bottlerName: normalizeText(row.bottler_name),
        brand: normalizeText(row.brand),
        country: normalizeText(row.country),
        abv: normalizeNumber(row.abv),
        ageStatement: normalizeNumber(row.age_statement),
        barcode: normalizeText(row.barcode),
        description: normalizeText(row.description),
        imageUrl: normalizeText(row.image_url),
        tags: toStringArray(row.tags),
        tastingNotes: toStringArray(row.tasting_notes)
      })),
      profiles: (profiles ?? []).map((row) => ({
        id: String(row.id),
        expressionId: String(row.expression_id),
        pillars: row.pillars ?? emptyPillars(),
        topNotes: toStringArray(row.top_notes),
        confidence: normalizeNumber(row.confidence) ?? 0,
        evidenceCount: normalizeNumber(row.evidence_count) ?? 0,
        explanation: normalizeText(row.explanation) ?? "",
        scoringVersion: normalizeText(row.scoring_version) ?? "v1",
        modelVersion: normalizeText(row.model_version) ?? "deterministic-v1",
        generatedAt: normalizeText(row.generated_at) ?? new Date().toISOString(),
        staleAt: normalizeText(row.stale_at) ?? null,
        createdAt: normalizeText(row.created_at) ?? new Date().toISOString(),
        updatedAt: normalizeText(row.updated_at) ?? new Date().toISOString()
      }))
    };
  }

  let store;
  try {
    store = JSON.parse(await readFile(storePath, "utf8"));
  } catch {
    throw new Error("Could not read data/mock-store.json. Run the app once or configure Supabase.");
  }

  const normalized = normalizeMockStore(store);
  return {
    kind: "mock",
    store: normalized,
    expressions: normalized.expressions,
    profiles: normalized.expressionFlavorProfiles
  };
}

export function selectExpressions(expressions, profiles, mode) {
  const profileByExpressionId = new Map(profiles.map((profile) => [profile.expressionId, profile]));

  if (mode === "all") {
    return expressions;
  }

  if (mode === "missing-flavor-profiles") {
    return expressions.filter((expression) => !profileByExpressionId.has(expression.id));
  }

  if (mode === "weak-notes") {
    return expressions.filter((expression) => {
      const notes = toStringArray(expression.tastingNotes);
      const profile = profileByExpressionId.get(expression.id);
      return notes.length < MIN_RELIABLE_TASTING_NOTES || (profile?.evidenceCount ?? 0) < MIN_RELIABLE_TASTING_NOTES;
    });
  }

  return expressions.filter((expression) => {
    const profile = profileByExpressionId.get(expression.id);
    return Boolean(profile?.staleAt);
  });
}

async function persistToSupabase(supabase, expression, profile) {
  const { error: expressionError } = await supabase.from("expressions").update({
    name: expression.name,
    distillery_name: expression.distilleryName ?? null,
    bottler_name: expression.bottlerName ?? null,
    brand: expression.brand ?? null,
    country: expression.country ?? null,
    abv: expression.abv ?? null,
    age_statement: expression.ageStatement ?? null,
    barcode: expression.barcode ?? null,
    description: expression.description ?? null,
    image_url: expression.imageUrl ?? null,
    tags: expression.tags,
    tasting_notes: expression.tastingNotes
  }).eq("id", expression.id);

  if (expressionError) {
    throw new Error(`Failed to update expression ${expression.id}: ${expressionError.message}`);
  }

  const { error: profileError } = await supabase.from("expression_flavor_profiles").upsert({
    id: profile.id,
    expression_id: profile.expressionId,
    pillars: profile.pillars,
    top_notes: profile.topNotes,
    confidence: profile.confidence,
    evidence_count: profile.evidenceCount,
    explanation: profile.explanation,
    scoring_version: profile.scoringVersion,
    model_version: profile.modelVersion,
    generated_at: profile.generatedAt,
    stale_at: profile.staleAt,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt
  }, { onConflict: "id" });

  if (profileError) {
    throw new Error(`Failed to upsert flavor profile ${profile.id}: ${profileError.message}`);
  }
}

export async function persistExpressionProfilePair(source, expression, profile) {
  if (source.kind === "supabase") {
    await persistToSupabase(source.supabase, expression, profile);
    return;
  }

  const expressionIndex = source.store.expressions.findIndex((entry) => entry.id === expression.id);
  if (expressionIndex < 0) {
    throw new Error(`Expression ${expression.id} not found in mock store during persist.`);
  }

  source.store.expressions[expressionIndex] = expression;

  const profileIndex = source.store.expressionFlavorProfiles.findIndex((entry) => entry.expressionId === expression.id);
  if (profileIndex < 0) {
    source.store.expressionFlavorProfiles.push(profile);
  } else {
    source.store.expressionFlavorProfiles[profileIndex] = profile;
  }
}

export async function flushSource(source) {
  if (source.kind !== "mock") return;
  await writeFile(storePath, JSON.stringify(source.store, null, 2), "utf8");
}
