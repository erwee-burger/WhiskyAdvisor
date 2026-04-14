import type { NewsFeedItem } from "@/lib/types";

const MAX_SEEN_ITEM_KEYS = 500;

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.hostname.toLowerCase()}${pathname.toLowerCase()}`;
  } catch {
    return trimmed
      .split("#")[0]
      .split("?")[0]
      .replace(/\/+$/, "")
      .toLowerCase();
  }
}

export function getNewsItemVisitKey(
  item: Pick<NewsFeedItem, "source" | "kind" | "name" | "url">
): string {
  const source = normalizeText(item.source);
  const identity = normalizeUrl(item.url) || normalizeText(item.name);
  return `${item.kind}:${source}:${identity}`;
}

export function reconcileSeenNewsItems(
  items: NewsFeedItem[],
  storedSeenKeys: Iterable<string> | null
): {
  hadBaseline: boolean;
  seenKeys: string[];
  unseenKeys: string[];
} {
  const currentKeys = Array.from(new Set(items.map(getNewsItemVisitKey)));

  if (!storedSeenKeys) {
    return {
      hadBaseline: false,
      seenKeys: currentKeys.slice(-MAX_SEEN_ITEM_KEYS),
      unseenKeys: []
    };
  }

  const seenSet = new Set(storedSeenKeys);
  const unseenKeys = currentKeys.filter(key => !seenSet.has(key));
  const mergedKeys = Array.from(new Set([...seenSet, ...currentKeys]));

  return {
    hadBaseline: true,
    seenKeys: mergedKeys.slice(-MAX_SEEN_ITEM_KEYS),
    unseenKeys
  };
}
