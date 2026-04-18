import {
  classifyFlavorProfile,
  flushSource,
  loadSource,
  persistExpressionProfilePair
} from "./lib/expression-cleanup-shared.mjs";

function printHelp() {
  console.log([
    "Reclassify saved flavor profiles from existing tasting notes without calling OpenAI.",
    "",
    "Usage:",
    "  node --env-file=.env.local scripts/reclassify-flavor-profiles.mjs",
    "  node scripts/reclassify-flavor-profiles.mjs --dry-run --limit 10",
    "",
    "Flags:",
    "  --dry-run",
    "  --limit N",
    "  --help"
  ].join("\n"));
}

function parseArgs(argv) {
  const parsed = {
    dryRun: false,
    limit: null
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

    if (arg === "--limit") {
      parsed.limit = Number(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (parsed.limit !== null && (!Number.isInteger(parsed.limit) || parsed.limit <= 0)) {
    throw new Error(`Invalid --limit "${parsed.limit}". Expected a positive integer.`);
  }

  return parsed;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const source = await loadSource();
  const profilesByExpressionId = new Map(source.profiles.map((profile) => [profile.expressionId, profile]));
  const selected = options.limit === null ? source.expressions : source.expressions.slice(0, options.limit);

  let updated = 0;

  console.log(`[reclassify-flavor-profiles] source=${source.kind} matched=${selected.length} dryRun=${options.dryRun}`);

  for (const [index, expression] of selected.entries()) {
    const label = `[${index + 1}/${selected.length}] ${expression.name}`;
    const profile = classifyFlavorProfile(expression, profilesByExpressionId.get(expression.id));
    console.log(
      `${label} - smoky=${profile.pillars.smoky}/10 sweet=${profile.pillars.sweet}/10 ` +
        `fruity=${profile.pillars.fruity}/10 evidence=${profile.evidenceCount}`
    );

    if (!options.dryRun) {
      await persistExpressionProfilePair(source, expression, profile);
    }

    updated += 1;
  }

  if (!options.dryRun) {
    await flushSource(source);
  }

  console.log("");
  console.log("[reclassify-flavor-profiles] Summary");
  console.log(`  source: ${source.kind}`);
  console.log(`  processed: ${selected.length}`);
  console.log(`  updated: ${updated}`);
  console.log(`  dry run: ${options.dryRun}`);
}

main().catch((error) => {
  console.error("[reclassify-flavor-profiles] Fatal error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
