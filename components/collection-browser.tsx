"use client";

import { useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { CollectionCard } from "@/components/collection-card";
import { getPeatTag } from "@/lib/tags";
import type { CollectionViewItem } from "@/lib/types";

function buildSearchHaystack(entry: CollectionViewItem) {
  return [
    entry.expression.name,
    entry.expression.brand,
    entry.expression.distilleryName,
    entry.expression.bottlerName,
    entry.expression.country,
    entry.expression.description,
    entry.expression.tags.join(" "),
    entry.item.status,
    entry.item.fillState,
    entry.item.purchaseSource,
    entry.item.personalNotes
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesFacet(entry: CollectionViewItem, filterType: string | null, filterValue: string | null): boolean {
  if (!filterType || !filterValue) return true;
  switch (filterType) {
    case "distillery":
      return entry.expression.distilleryName === filterValue;
    case "bottler":
      return entry.expression.bottlerName === filterValue;
    case "region":
      return entry.expression.country === filterValue;
    case "peat": {
      const tag = getPeatTag(entry.expression.tags) ?? "unspecified";
      return tag === filterValue;
    }
    case "rating":
      return entry.item.rating === Number(filterValue);
    default:
      return true;
  }
}

export function CollectionBrowser({ collection }: { collection: CollectionViewItem[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const filterType = searchParams.get("filterType");
  const filterValue = searchParams.get("filterValue");

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return collection.filter((entry) => {
      const statusMatch = status === "all" ? true : entry.item.status === status;
      const textMatch = normalized ? buildSearchHaystack(entry).includes(normalized) : true;
      const facetMatch = matchesFacet(entry, filterType, filterValue);
      return statusMatch && textMatch && facetMatch;
    });
  }, [collection, query, status, filterType, filterValue]);

  const rows = useMemo(() => {
    const chunkSize = 5;
    const output: CollectionViewItem[][] = [];
    for (let i = 0; i < visible.length; i += chunkSize) {
      output.push(visible.slice(i, i + chunkSize));
    }
    return output;
  }, [visible]);

  return (
    <section className="shelf-room">
      <div className="shelf-toolbar">
        <div className="field shelf-search">
          <label htmlFor="collection-search">Search by bottle, distillery, or tag</label>
          <input
            id="collection-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try smoke, Islay, Signatory, sherry, tropical-fruit..."
            value={query}
          />
        </div>
        <div className="field shelf-filter">
          <label htmlFor="collection-status">Status</label>
          <select
            id="collection-status"
            onChange={(event) => setStatus(event.target.value)}
            value={status}
          >
            <option value="all">All bottles</option>
            <option value="owned">Owned</option>
            <option value="wishlist">Wishlist</option>
          </select>
        </div>
      </div>

      <div className="shelf-caption">
        <p>{visible.length} bottles on the shelf right now.</p>
        <div className="pill-row">
          {filterType && filterValue ? (
            <button className="pill pill--filter" onClick={() => router.push("/collection")}>
              {filterType}: {filterValue} &times;
            </button>
          ) : (
            <>
              <span className="pill">Hover a bottle for quick details</span>
              <span className="pill">Search matches flavor tags too</span>
            </>
          )}
        </div>
      </div>

      {visible.length > 0 ? (
        <div className="shelf-stack">
          {rows.map((row, index) => (
            <section className="shelf-row" key={`row-${index}`}>
              <div className="shelf-grid">
                {row.map((entry) => (
                  <CollectionCard entry={entry} interactive key={entry.item.id} />
                ))}
              </div>
              <div className="shelf-rail" />
            </section>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          No whiskies matched that search. Try a tag like `smoke`, `sherry`, `Campbeltown`, or
          `independent`.
        </div>
      )}
    </section>
  );
}
