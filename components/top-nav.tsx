"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
};

export function TopNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="top-nav">
      <div className="top-nav-inner">
        <div className="top-nav-brand-block">
          <p className="eyebrow">Private Cellar</p>
          <Link className="top-nav-brand" href="/" onClick={() => setIsOpen(false)}>
            Whisky Advisor
          </Link>
        </div>

        <div className="top-nav-menu-wrap">
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
                <Link
                  className={`menu-link${pathname === item.href ? " menu-link-active" : ""}`}
                  href={item.href}
                  key={item.href}
                  onClick={() => setIsOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
