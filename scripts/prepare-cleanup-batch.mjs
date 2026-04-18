import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildBatchRequestLine,
  DEFAULT_MODEL,
  loadSource,
  selectExpressions,
  VALID_MODES
} from "./lib/expression-cleanup-shared.mjs";

function printHelp() {
  console.log([
    "Prepare a Batch API input file for expression cleanup enrichment.",
    "",
    "Usage:",
    "  node --env-file=.env.local scripts/prepare-cleanup-batch.mjs --mode missing-flavor-profiles",
    "  node --env-file=.env.local scripts/prepare-cleanup-batch.mjs --mode weak-notes",
    "  node scripts/prepare-cleanup-batch.mjs --mode all --limit 100 --out-dir tmp/cleanup-batches/manual-run",
    "",
    "Flags:",
    "  --mode MODE       all | missing-flavor-profiles | stale | weak-notes",
    "  --limit N         Optional positive integer cap",
    "  --model NAME      Override the enrichment model",
    "  --out-dir PATH    Output directory for manifest + requests.jsonl",
    "  --help"
  ].join("\n"));
}

function parseArgs(argv) {
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const parsed = {
    mode: "all",
    limit: null,
    model: DEFAULT_MODEL,
    outDir: path.join("tmp", "cleanup-batches", timestamp)
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
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

    if (arg === "--out-dir") {
      parsed.outDir = argv[index + 1] ?? parsed.outDir;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!VALID_MODES.has(parsed.mode)) {
    throw new Error(`Invalid --mode "${parsed.mode}". Expected one of: ${[...VALID_MODES].join(", ")}`);
  }

  if (parsed.limit !== null && (!Number.isInteger(parsed.limit) || parsed.limit <= 0)) {
    throw new Error(`Invalid --limit "${parsed.limit}". Expected a positive integer.`);
  }

  return parsed;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const source = await loadSource();
  const matched = selectExpressions(source.expressions, source.profiles, options.mode);
  const selected = options.limit === null ? matched : matched.slice(0, options.limit);

  await mkdir(options.outDir, { recursive: true });

  const requestsPath = path.resolve(options.outDir, "requests.jsonl");
  const manifestPath = path.resolve(options.outDir, "manifest.json");
  const lines = selected.map((expression) => JSON.stringify(buildBatchRequestLine(expression, options.model)));
  await writeFile(requestsPath, `${lines.join("\n")}${lines.length > 0 ? "\n" : ""}`, "utf8");

  const manifest = {
    createdAt: new Date().toISOString(),
    source: source.kind,
    mode: options.mode,
    model: options.model,
    matchedCount: matched.length,
    selectedCount: selected.length,
    requestsPath,
    expressionIds: selected.map((expression) => expression.id)
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`[prepare-cleanup-batch] source=${source.kind} mode=${options.mode} selected=${selected.length}`);
  console.log(`[prepare-cleanup-batch] requests=${requestsPath}`);
  console.log(`[prepare-cleanup-batch] manifest=${manifestPath}`);
}

main().catch((error) => {
  console.error("[prepare-cleanup-batch] Fatal error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
