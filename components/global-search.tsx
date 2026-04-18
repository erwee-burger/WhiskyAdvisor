// components/global-search.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SearchResult = {
  id: string;
  name: string;
  status: "owned" | "wishlist";
  fillState: "sealed" | "open" | "finished";
};

const STATUS_LABEL: Record<string, string> = {
  owned: "In Collection",
  wishlist: "Wishlist"
};

const FILL_LABEL: Record<string, string> = {
  sealed: "Sealed",
  open: "Open",
  finished: "Finished"
};

export function GlobalSearch() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Click-outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/collection/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) return;
        const data = await res.json() as { results: SearchResult[] };
        setResults(data.results);
      } catch {
        // Non-fatal: leave stale results
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function close() {
    setIsOpen(false);
    setQuery("");
    setResults([]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      close();
    } else if (e.key === "Enter" && query.trim().length >= 2) {
      router.push(`/collection?q=${encodeURIComponent(query.trim())}`);
      close();
    }
  }

  function handleResultClick(id: string) {
    router.push(`/collection/${id}`);
    close();
  }

  return (
    <div className="global-search" ref={containerRef}>
      {!isOpen ? (
        <button
          aria-label="Open search"
          className="global-search-icon"
          onClick={() => setIsOpen(true)}
          type="button"
        >
          <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" x2="16.65" y1="21" y2="16.65" />
          </svg>
        </button>
      ) : (
        <div className="global-search-expanded">
          <input
            aria-label="Search your collection"
            autoComplete="off"
            className="global-search-input"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search bottles, distilleries, tags..."
            ref={inputRef}
            type="search"
            value={query}
          />
          <button
            aria-label="Close search"
            className="global-search-close"
            onClick={close}
            type="button"
          >
            ✕
          </button>

          {(results.length > 0 || query.length >= 2) && (
            <div className="global-search-dropdown">
              {results.length === 0 ? (
                <div className="global-search-empty">No bottles found</div>
              ) : (
                <>
                  {results.map((result) => (
                    <button
                      className="global-search-result"
                      key={result.id}
                      onClick={() => handleResultClick(result.id)}
                      type="button"
                    >
                      <span className="global-search-result-name">{result.name}</span>
                      <span className="global-search-result-meta">
                        <span className="global-search-badge">{STATUS_LABEL[result.status] ?? result.status}</span>
                        <span className="global-search-fill">{FILL_LABEL[result.fillState] ?? result.fillState}</span>
                      </span>
                    </button>
                  ))}
                  <div className="global-search-footer">
                    Press Enter to see all {results.length === 5 ? "5+" : results.length} results in Collection →
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
