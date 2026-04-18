import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  classifyFlavorProfile,
  diffExpression,
  flushSource,
  loadSource,
  mergeExpression,
  parseBatchOutputEntry,
  persistExpressionProfilePair
} from "./lib/expression-cleanup-shared.mjs";

function printHelp() {
  console.log([
    "Apply Batch API cleanup results back into the store.",
    "",
    "Usage:",
    "  node --env-file=.env.local scripts/apply-cleanup-batch-results.mjs --output tmp/cleanup-batches/<run>/batch-<id>-output.jsonl",
    "  node scripts/apply-cleanup-batch-results.mjs --output tmp/cleanup-batches/<run>/batch-<id>-output.jsonl --dry-run",
    "",
    "Flags:",
    "  --output PATH     Downloaded batch output JSONL file",
    "  --dry-run         Parse and merge without writing",
    "  --min-notes N     Skip rows whose model output has fewer than N tasting notes (default 6)",
    "  --allow-identity-updates  Allow batch results to rewrite identity fields",
    "  --help"
  ].join("\n"));
}

function parseArgs(argv) {
  const parsed = {
    outputPath: null,
    dryRun: false,
    minNotes: 6,
    allowIdentityUpdates: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (arg === "--output") {
      parsed.outputPath = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }

    if (arg === "--min-notes") {
      parsed.minNotes = Number(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--allow-identity-updates") {
      parsed.allowIdentityUpdates = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!parsed.outputPath) {
    throw new Error("Provide --output with a batch output JSONL file.");
  }

  if (!Number.isInteger(parsed.minNotes) || parsed.minNotes < 0) {
    throw new Error(`Invalid --min-notes "${parsed.minNotes}". Expected a non-negative integer.`);
  }

  return parsed;
}

function countNotes(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string" && entry.trim()).length : 0;
}

function sanitizeEnrichment(enriched, allowIdentityUpdates) {
  if (!enriched || typeof enriched !== "object") {
    return enriched;
  }

  if (allowIdentityUpdates) {
    return enriched;
  }

  return {
    ...enriched,
    name: null,
    distilleryName: null,
    bottlerName: null,
    brand: null,
    country: null,
    barcode: null
  };
}

async function loadJsonl(filePath) {
  const content = await readFile(filePath, "utf8");
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Could not parse JSONL line ${index + 1}: ${error instanceof Error ? error.message : error}`);
      }
    });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const source = await loadSource();
  const rows = await loadJsonl(path.resolve(options.outputPath));

  const expressionsById = new Map(source.expressions.map((expression) => [expression.id, expression]));
  const profilesByExpressionId = new Map(source.profiles.map((profile) => [profile.expressionId, profile]));

  let applied = 0;
  let changedExpressions = 0;
  let malformed = 0;
  let responseErrors = 0;
  let missingExpressions = 0;
  let skippedWeakRows = 0;

  for (const row of rows) {
    const result = parseBatchOutputEntry(row);

    if (!result.expressionId) {
      malformed += 1;
      console.error("[apply-cleanup-batch-results] skipping row with invalid custom_id");
      continue;
    }

    const current = expressionsById.get(result.expressionId);
    if (!current) {
      missingExpressions += 1;
      console.error(`[apply-cleanup-batch-results] expression ${result.expressionId} not found`);
      continue;
    }

    if (result.statusCode !== 200 || result.error) {
      responseErrors += 1;
      console.error(
        `[apply-cleanup-batch-results] ${current.name} - response error ${result.statusCode ?? "unknown"}`
      );
      continue;
    }

    if (!result.parsed) {
      malformed += 1;
      console.error(`[apply-cleanup-batch-results] ${current.name} - could not parse model JSON`);
      continue;
    }

    const rawNoteCount = countNotes(result.parsed.tastingNotes);
    if (rawNoteCount < options.minNotes) {
      skippedWeakRows += 1;
      console.error(
        `[apply-cleanup-batch-results] ${current.name} - skipped weak enrichment (${rawNoteCount} tasting notes)`
      );
      continue;
    }

    const nextExpression = mergeExpression(
      current,
      sanitizeEnrichment(result.parsed, options.allowIdentityUpdates)
    );
    const profile = classifyFlavorProfile(nextExpression, profilesByExpressionId.get(current.id));
    const changedFields = diffExpression(current, nextExpression);

    if (changedFields.length > 0) {
      changedExpressions += 1;
    }

    console.log(
      `[apply-cleanup-batch-results] ${current.name} - ${changedFields.length > 0 ? `changed ${changedFields.join(", ")}` : "unchanged"}; ` +
        `tags=${nextExpression.tags.length}; tastingNotes=${nextExpression.tastingNotes.length}; confidence=${profile.confidence}`
    );

    expressionsById.set(current.id, nextExpression);
    profilesByExpressionId.set(current.id, profile);

    if (!options.dryRun) {
      await persistExpressionProfilePair(source, nextExpression, profile);
    }

    applied += 1;
  }

  if (!options.dryRun) {
    await flushSource(source);
  }

  console.log("");
  console.log("[apply-cleanup-batch-results] Summary");
  console.log(`  source: ${source.kind}`);
  console.log(`  output rows: ${rows.length}`);
  console.log(`  applied: ${applied}`);
  console.log(`  expressions changed: ${changedExpressions}`);
  console.log(`  malformed rows: ${malformed}`);
  console.log(`  response errors: ${responseErrors}`);
  console.log(`  missing expressions: ${missingExpressions}`);
  console.log(`  skipped weak rows: ${skippedWeakRows}`);
  console.log(`  dry run: ${options.dryRun}`);
}

main().catch((error) => {
  console.error("[apply-cleanup-batch-results] Fatal error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
