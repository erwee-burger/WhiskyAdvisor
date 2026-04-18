import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  BATCH_COMPLETION_WINDOW,
  BATCH_ENDPOINT
} from "./lib/expression-cleanup-shared.mjs";

const OPENAI_API_BASE = "https://api.openai.com/v1";
const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled", "expired"]);

function printHelp() {
  console.log([
    "Submit, inspect, and download Batch API jobs for expression cleanup.",
    "",
    "Usage:",
    "  node --env-file=.env.local scripts/run-cleanup-batch.mjs --input tmp/cleanup-batches/<run>/requests.jsonl",
    "  node --env-file=.env.local scripts/run-cleanup-batch.mjs --batch batch_123 --wait --download",
    "",
    "Flags:",
    "  --input PATH       JSONL file prepared for Batch API submission",
    "  --batch ID         Existing batch id to inspect/poll",
    "  --out-dir PATH     Output directory for manifests/downloads",
    "  --wait             Poll until the batch reaches a terminal state",
    "  --poll-seconds N   Poll interval when --wait is used (default 30)",
    "  --download         Download output/error files when available",
    "  --help"
  ].join("\n"));
}

function parseArgs(argv) {
  const parsed = {
    inputPath: null,
    batchId: null,
    outDir: null,
    wait: false,
    pollSeconds: 30,
    download: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (arg === "--input") {
      parsed.inputPath = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === "--batch") {
      parsed.batchId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === "--out-dir") {
      parsed.outDir = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === "--wait") {
      parsed.wait = true;
      continue;
    }

    if (arg === "--poll-seconds") {
      parsed.pollSeconds = Number(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--download") {
      parsed.download = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!parsed.inputPath && !parsed.batchId) {
    throw new Error("Provide either --input to submit a new batch or --batch to inspect an existing one.");
  }

  if (parsed.inputPath && parsed.batchId) {
    throw new Error("Use either --input or --batch, not both.");
  }

  if (!Number.isInteger(parsed.pollSeconds) || parsed.pollSeconds <= 0) {
    throw new Error(`Invalid --poll-seconds "${parsed.pollSeconds}". Expected a positive integer.`);
  }

  if (!parsed.outDir) {
    parsed.outDir = parsed.inputPath
      ? path.dirname(path.resolve(parsed.inputPath))
      : path.resolve(path.join("tmp", "cleanup-batches", parsed.batchId));
  }

  return parsed;
}

function getApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }
  return apiKey;
}

async function openAiJson(apiKey, relativeUrl, init = {}) {
  const response = await fetch(`${OPENAI_API_BASE}${relativeUrl}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`${init.method ?? "GET"} ${relativeUrl} ${response.status}: ${body}`);
  }

  return response.json();
}

async function uploadBatchInput(apiKey, inputPath) {
  const content = await readFile(inputPath);
  const form = new FormData();
  form.append("purpose", "batch");
  form.append("file", new Blob([content], { type: "application/jsonl" }), path.basename(inputPath));

  return openAiJson(apiKey, "/files", {
    method: "POST",
    body: form
  });
}

async function createBatch(apiKey, inputFileId) {
  return openAiJson(apiKey, "/batches", {
    method: "POST",
    body: JSON.stringify({
      input_file_id: inputFileId,
      endpoint: BATCH_ENDPOINT,
      completion_window: BATCH_COMPLETION_WINDOW,
      metadata: {
        workflow: "expression_cleanup"
      }
    })
  });
}

async function fetchBatch(apiKey, batchId) {
  return openAiJson(apiKey, `/batches/${batchId}`);
}

async function downloadFile(apiKey, fileId, destinationPath) {
  const response = await fetch(`${OPENAI_API_BASE}/files/${fileId}/content`, {
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`GET /files/${fileId}/content ${response.status}: ${body}`);
  }

  await writeFile(destinationPath, await response.text(), "utf8");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function persistBatchManifest(outDir, batch, extra = {}) {
  await mkdir(outDir, { recursive: true });
  const manifestPath = path.resolve(outDir, `batch-${batch.id}.json`);
  await writeFile(
    manifestPath,
    `${JSON.stringify({ savedAt: new Date().toISOString(), batch, ...extra }, null, 2)}\n`,
    "utf8"
  );
  return manifestPath;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const apiKey = getApiKey();

  let batch;

  if (options.inputPath) {
    console.log(`[run-cleanup-batch] uploading ${path.resolve(options.inputPath)}`);
    const uploadedFile = await uploadBatchInput(apiKey, path.resolve(options.inputPath));
    console.log(`[run-cleanup-batch] uploaded file ${uploadedFile.id}`);

    batch = await createBatch(apiKey, uploadedFile.id);
    console.log(`[run-cleanup-batch] created batch ${batch.id} status=${batch.status}`);
    const manifestPath = await persistBatchManifest(options.outDir, batch, {
      inputPath: path.resolve(options.inputPath),
      uploadedFileId: uploadedFile.id
    });
    console.log(`[run-cleanup-batch] manifest=${manifestPath}`);
  } else {
    batch = await fetchBatch(apiKey, options.batchId);
    console.log(`[run-cleanup-batch] batch ${batch.id} status=${batch.status}`);
  }

  if (options.wait) {
    while (!TERMINAL_STATUSES.has(batch.status)) {
      console.log(`[run-cleanup-batch] waiting ${options.pollSeconds}s for batch ${batch.id} currently ${batch.status}`);
      await sleep(options.pollSeconds * 1000);
      batch = await fetchBatch(apiKey, batch.id);
    }
    console.log(`[run-cleanup-batch] batch ${batch.id} reached terminal status ${batch.status}`);
  }

  if (options.download) {
    await mkdir(options.outDir, { recursive: true });

    if (batch.output_file_id) {
      const outputPath = path.resolve(options.outDir, `batch-${batch.id}-output.jsonl`);
      await downloadFile(apiKey, batch.output_file_id, outputPath);
      console.log(`[run-cleanup-batch] output=${outputPath}`);
    }

    if (batch.error_file_id) {
      const errorPath = path.resolve(options.outDir, `batch-${batch.id}-errors.jsonl`);
      await downloadFile(apiKey, batch.error_file_id, errorPath);
      console.log(`[run-cleanup-batch] errors=${errorPath}`);
    }
  }

  const manifestPath = await persistBatchManifest(options.outDir, batch);
  console.log(`[run-cleanup-batch] manifest=${manifestPath}`);
}

main().catch((error) => {
  console.error("[run-cleanup-batch] Fatal error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
