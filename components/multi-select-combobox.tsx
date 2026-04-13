"use client";

import { useEffect, useRef, useState } from "react";

interface MultiSelectComboboxProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

export function MultiSelectCombobox({
  label,
  options,
  selected,
  onChange,
  placeholder
}: MultiSelectComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = options.filter((opt) => opt.toLowerCase().includes(query.toLowerCase()));

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  function handleClose() {
    setOpen(false);
    setQuery("");
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayValue =
    selected.length === 0
      ? ""
      : selected.length <= 2
        ? selected.join(", ")
        : `${selected.length} selected`;

  return (
    <div className="msc-container" ref={containerRef}>
      <label className="msc-label">{label}</label>
      <button
        aria-expanded={open}
        className={`msc-trigger${selected.length > 0 ? " msc-trigger-active" : ""}`}
        onClick={() => setOpen((prev) => !prev)}
        type="button"
      >
        <span className="msc-value">{displayValue || placeholder || `All ${label}`}</span>
        <span className="msc-arrow">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="msc-dropdown">
          <input
            autoFocus
            className="msc-search"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") handleClose();
            }}
            placeholder="Search..."
            type="text"
            value={query}
          />
          <ul className="msc-list">
            {filtered.length === 0 ? (
              <li className="msc-empty">No matches</li>
            ) : (
              filtered.map((opt) => (
                <li key={opt}>
                  <label className="msc-option">
                    <input checked={selected.includes(opt)} onChange={() => toggle(opt)} type="checkbox" />
                    {opt}
                  </label>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
