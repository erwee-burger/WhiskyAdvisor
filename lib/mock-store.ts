import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { seedStore } from "@/lib/seed-data";
import {
  isSupabaseStoreEnabled,
  readStoreFromSupabase,
  writeStoreToSupabase
} from "@/lib/supabase-store";
import type { WhiskyStore } from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
const storePath = path.join(dataDir, "mock-store.json");

async function ensureStoreFile() {
  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(storePath, "utf8");
  } catch {
    await writeStore(seedStore);
  }
}

export async function readStore() {
  if (isSupabaseStoreEnabled()) {
    return readStoreFromSupabase();
  }

  await ensureStoreFile();
  const contents = await readFile(storePath, "utf8");
  return JSON.parse(contents) as WhiskyStore;
}

export async function writeStore(store: WhiskyStore) {
  if (isSupabaseStoreEnabled()) {
    await writeStoreToSupabase(store);
    return;
  }

  await mkdir(dataDir, { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}
