import type { Metadata } from "next";
import Link from "next/link";

import "@/app/globals.css";
import { assertProductionEnv } from "@/lib/env";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/collection", label: "Collection" },
  { href: "/add", label: "Add Bottle" },
  { href: "/analytics", label: "Analytics" },
  { href: "/advisor", label: "Advisor" },
  { href: "/compare", label: "Compare" },
  { href: "/export", label: "Export" }
];

export const metadata: Metadata = {
  title: "Whisky Advisor",
  description: "A private whisky collection, tasting, and recommendation app."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  assertProductionEnv();

  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <aside className="sidebar">
            <div className="brand-block">
              <p className="eyebrow">Private Cellar</p>
              <Link className="brand" href="/">
                Whisky Advisor
              </Link>
              <p className="brand-copy">
                Catalog your whiskies, track prices, and get guidance from your own palate.
              </p>
            </div>
            <nav className="nav-grid">
              {navItems.map((item) => (
                <Link className="nav-link" href={item.href} key={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
