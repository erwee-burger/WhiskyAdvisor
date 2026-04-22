"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

import { GlobalSearch } from "@/components/global-search";
import { PendingLink } from "@/components/navigation-feedback";

type NavItem = {
  href: string;
  label: string;
};

// Shown inline on desktop (≥900px). Remaining items stay in the hamburger.
const DESKTOP_PRIMARY: string[] = ["/", "/collection", "/analytics", "/advisor", "/tastings"];

export function TopNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const desktopItems = items.filter((i) => DESKTOP_PRIMARY.includes(i.href));

  return (
    <header className="top-nav">
      <div className="top-nav-inner">
        <div className="top-nav-brand-block">
          <p className="eyebrow">Private Cellar</p>
          <PendingLink className="top-nav-brand" href="/" onClick={() => setIsOpen(false)}>
            Whisky Advisor
          </PendingLink>
        </div>

        {/* ── Inline nav (desktop only) ── */}
        <nav className="top-nav-desktop-links" aria-label="Primary navigation">
          {desktopItems.map((item) => (
            <PendingLink
              key={item.href}
              href={item.href}
              className={`top-nav-desktop-link${pathname === item.href ? " top-nav-desktop-link-active" : ""}`}
              onClick={() => setIsOpen(false)}
            >
              {item.label}
            </PendingLink>
          ))}
        </nav>

        <div className="top-nav-menu-wrap">
          <GlobalSearch />

          <button
            aria-controls="main-menu"
            aria-expanded={isOpen}
            aria-label="Open navigation menu"
            className={`menu-toggle${isOpen ? " menu-toggle-open" : ""}`}
            onClick={() => setIsOpen((current) => !current)}
            type="button"
          >
            <span />
            <span />
            <span />
          </button>

          <nav className={`menu-dropdown${isOpen ? " menu-dropdown-open" : ""}`} id="main-menu">
            <p className="menu-copy">
              Catalog your whiskies, track prices, and move between your private whisky tools quickly.
            </p>
            <div className="menu-links">
              {items.map((item) => (
                <PendingLink
                  className={`menu-link${pathname === item.href ? " menu-link-active" : ""}`}
                  href={item.href}
                  key={item.href}
                  onClick={() => setIsOpen(false)}
                >
                  {item.label}
                </PendingLink>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
