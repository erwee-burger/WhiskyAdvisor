import type { Metadata } from "next";

import "@/app/globals.css";
import { TopNav } from "@/components/top-nav";
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
          <TopNav items={navItems} />
          <main className="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
