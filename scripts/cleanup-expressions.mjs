/**
 * Cleanup expressions into the canonical tasting-notes + structural-tags model.
 *
 * Usage:
 *   node --env-file=.env.local scripts/cleanup-expressions.mjs --mode all
 *   node --env-file=.env.local scripts/cleanup-expressions.mjs --mode missing-flavor-profiles
 *   node --env-file=.env.local scripts/cleanup-expressions.mjs --mode stale --dry-run
 *   node scripts/cleanup-expressions.mjs --mode all --limit 10
 *
 * Modes:
 *   --mode all                      Process every expression.
 *   --mode missing-flavor-profiles  Process only expressions without a saved flavor profile.
 *   --mode stale                    Process only expressions with stale profiles.
 *
 * Flags:
 *   --dry-run     Run the full pipeline but do not persist writes.
 *   --limit N     Only process the first N matched expressions.
 *   --model NAME  Override the OpenAI model for enrichment.
 *   --help        Show this message.
 */

import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const storePath = path.join(__dirname, "../data/mock-store.json");

const PEAT_TAGS = new Set(["unpeated", "peated", "heavily-peated"]);
const KNOWN_CASK_TYPE_TAGS = new Set([
  "px",
  "amontillado",
  "oloroso",
  "mizunara",
  "virgin-oak",
  "refill-cask"
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
const VALID_MODES = new Set(["all", "missing-flavor-profiles", "stale"]);

function parseArgs(argv) {
  const parsed = {
    mode: "all",
    dryRun: false,
    limit: Infinity,
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }

    if (arg === "--mode") {
      parsed.mode = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--limit") {
      parsed.limit = Number(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--model") {
      parsed.model = argv[index + 1] ?? parsed.model;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!VALID_MODES.has(parsed.mode)) {
    throw new Error(`Invalid --mode "${parsed.mode}". Expected one of: ${[...VALID_MODES].join(", ")}`);
  }

  if (!Number.isFinite(parsed.limit) || parsed.limit <= 0) {
    throw new Error(`Invalid --limit "${parsed.limit}". Expected a positive number.`);
  }

  return parsed;
}

function printHelp() {
  console.log([
    "Cleanup expressions into canonical structural tags + tasting notes + flavor profiles.",
    "",
    "Usage:",
    "  node --env-file=.env.local scripts/cleanup-expressions.mjs --mode all",
    "  node --env-file=.env.local scripts/cleanup-expressions.mjs --mode missing-flavor-profiles --dry-run",
    "  node scripts/cleanup-expressions.mjs --mode stale --limit 5",
    "",
    "Modes:",
    "  all",
    "  missing-flavor-profiles",
    "  stale",
    "",
    "Flags:",
    "  --dry-run",
    "  --limit N",
    "  --model NAME",
    "  --help"
  ].join("\n"));
}

function normalizeText(value) {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

function normalizeNumber(value) {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeToken(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => typeof entry === "string");
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function includeStructuralTag(tags, rawValue, suffix = "") {
  if (!rawValue) return;
  const normalized = normalizeToken(rawValue);
  if (!normalized || FLAVOR_DENYLIST.has(normalized)) return;
  tags.add(`${normalized}${suffix}`);
}

function generateTagsFromFacts(facts, abv) {
  const tags = new Set();
  const source = facts ?? {};

  includeStructuralTag(tags, source.whiskyType);
  includeStructuralTag(tags, source.peatLevel);

  for (const influence of toStringArray(source.caskInfluences)) {
    includeStructuralTag(tags, influence, "-cask");
  }

  includeStructuralTag(tags, source.caskType);

  for (const finish of toStringArray(source.finishes)) {
    includeStructuralTag(tags, finish, "-finish");
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
    return explicit.slice(0, 12);
  }

  return uniqueStrings(
    toStringArray(expression.tags)
      .map(normalizeToken)
      .filter((tag) => looksLikeFlavorNote(tag))
      .map((tag) => tag.replaceAll("-", " "))
  ).slice(0, 12);
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

function classifyFlavorProfile(expression, previousProfile) {
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

  const maxScore = Math.max(1, ...Object.values(rawPillars));
  const pillars = Object.fromEntries(
    Object.entries(rawPillars).map(([pillar, value]) => [
      pillar,
      Math.min(10, Math.round((value / maxScore) * 10))
    ])
  );

  const confidence = Math.max(0.25, Math.min(0.95, 0.35 + notes.length * 0.08 + (expression.description ? 0.06 : 0)));
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
        ? `Built from tasting notes (${notes.slice(0, 3).join(", ")}) with bounded metadata priors.`
        : "Built from structural metadata only, so confidence is reduced.",
    scoringVersion: "v1",
    modelVersion: "deterministic-v1",
    generatedAt: now,
    staleAt: null,
    createdAt: previousProfile?.createdAt ?? now,
    updatedAt: now
  };
}

function buildLookupPrompt(expression) {
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

async function callOpenAiForExpression(expression, model) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { parsed: null, rawText: null, reason: "OPENAI_API_KEY not set" };
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: "low" },
      tools: [{ type: "web_search_preview" }],
      input: buildLookupPrompt(expression)
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenAI Responses API ${response.status}: ${body}`);
  }

  const payload = await response.json();
  const rawText = extractOutputText(payload);
  return {
    parsed: extractJson(rawText),
    rawText,
    reason: rawText ? null : "No output_text returned"
  };
}

function extractOutputText(payload) {
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

function extractJson(text) {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function mergeExpression(existing, enriched) {
  const resolved = enriched ?? {};
  const abv = normalizeNumber(resolved.abv) ?? existing.abv;

  const next = {
    ...existing,
    name: normalizeText(resolved.name) ?? existing.name,
    distilleryName: normalizeText(resolved.distilleryName) ?? existing.distilleryName,
    bottlerName: normalizeText(resolved.bottlerName) ?? existing.bottlerName,
    brand: normalizeText(resolved.brand) ?? existing.brand,
    country: normalizeText(resolved.country) ?? existing.country,
    abv,
    ageStatement: normalizeNumber(resolved.ageStatement) ?? existing.ageStatement,
    barcode: normalizeText(resolved.barcode) ?? existing.barcode,
    description: normalizeText(resolved.description) ?? existing.description
  };

  const generatedTags =
    resolved.facts && typeof resolved.facts === "object"
      ? generateTagsFromFacts(resolved.facts, abv)
      : fallbackStructuralTags(existing);
  const tastingNotes =
    uniqueStrings(toStringArray(resolved.tastingNotes).map((note) => normalizeText(note)).filter(Boolean)).slice(0, 12);

  next.tags = generatedTags;
  next.tastingNotes = tastingNotes.length > 0 ? tastingNotes : salvageTastingNotes(existing);

  return next;
}

function diffExpression(previous, next) {
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

async function loadSource() {
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

function selectExpressions(expressions, profiles, mode) {
  const profileByExpressionId = new Map(profiles.map((profile) => [profile.expressionId, profile]));

  if (mode === "all") {
    return expressions;
  }

  if (mode === "missing-flavor-profiles") {
    return expressions.filter((expression) => !profileByExpressionId.has(expression.id));
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const source = await loadSource();
  const selected = selectExpressions(source.expressions, source.profiles, options.mode).slice(0, options.limit);

  console.log(
    `[cleanup-expressions] source=${source.kind} mode=${options.mode} dryRun=${options.dryRun} matched=${selected.length}`
  );

  if (selected.length === 0) {
    console.log("[cleanup-expressions] Nothing to do.");
    return;
  }

  const profileByExpressionId = new Map(source.profiles.map((profile) => [profile.expressionId, profile]));
  const mockExpressionById =
    source.kind === "mock"
      ? new Map(source.store.expressions.map((expression, index) => [expression.id, index]))
      : null;
  const mockProfileByExpressionId =
    source.kind === "mock"
      ? new Map(source.store.expressionFlavorProfiles.map((profile, index) => [profile.expressionId, index]))
      : null;

  let changedExpressions = 0;
  let upsertedProfiles = 0;
  let aiEnriched = 0;
  let fallbackOnly = 0;
  let failures = 0;

  for (const [index, expression] of selected.entries()) {
    const label = `[${index + 1}/${selected.length}] ${expression.name}`;
    try {
      console.log(`${label} - resolving`);
      const enrichment = await callOpenAiForExpression(expression, options.model).catch((error) => ({
        parsed: null,
        rawText: null,
        reason: error instanceof Error ? error.message : String(error)
      }));
      const nextExpression = mergeExpression(expression, enrichment.parsed);
      const changedFields = diffExpression(expression, nextExpression);
      const profile = classifyFlavorProfile(nextExpression, profileByExpressionId.get(expression.id));

      if (enrichment.parsed) {
        aiEnriched += 1;
      } else {
        fallbackOnly += 1;
      }

      if (changedFields.length > 0) {
        changedExpressions += 1;
      }

      console.log(
        `${label} - ${changedFields.length > 0 ? `changed ${changedFields.join(", ")}` : "expression unchanged"}; ` +
          `tags=${nextExpression.tags.length}; tastingNotes=${nextExpression.tastingNotes.length}; ` +
          `confidence=${profile.confidence}` +
          (enrichment.reason ? `; fallback=${enrichment.reason}` : "")
      );

      if (options.dryRun) {
        upsertedProfiles += 1;
        continue;
      }

      if (source.kind === "supabase") {
        await persistToSupabase(source.supabase, nextExpression, profile);
      } else {
        const expressionIndex = mockExpressionById.get(expression.id);
        if (expressionIndex === undefined) {
          throw new Error(`Expression ${expression.id} not found in mock store during persist.`);
        }
        source.store.expressions[expressionIndex] = nextExpression;

        const profileIndex = mockProfileByExpressionId.get(expression.id);
        if (profileIndex === undefined) {
          source.store.expressionFlavorProfiles.push(profile);
          mockProfileByExpressionId.set(expression.id, source.store.expressionFlavorProfiles.length - 1);
        } else {
          source.store.expressionFlavorProfiles[profileIndex] = profile;
        }
      }

      upsertedProfiles += 1;
    } catch (error) {
      failures += 1;
      console.error(`${label} - failed:`, error instanceof Error ? error.message : error);
    }
  }

  if (!options.dryRun && source.kind === "mock") {
    await writeFile(storePath, JSON.stringify(source.store, null, 2), "utf8");
  }

  console.log("");
  console.log("[cleanup-expressions] Summary");
  console.log(`  processed: ${selected.length}`);
  console.log(`  expressions changed: ${changedExpressions}`);
  console.log(`  flavor profiles upserted: ${upsertedProfiles}`);
  console.log(`  AI-enriched: ${aiEnriched}`);
  console.log(`  fallback-only: ${fallbackOnly}`);
  console.log(`  failures: ${failures}`);

  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[cleanup-expressions] Fatal error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
