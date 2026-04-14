import type { Metadata } from "next";

import "@/app/globals.css";
import { NavigationFeedbackProvider } from "@/components/navigation-feedback";
import { TopNav } from "@/components/top-nav";
import { assertProductionEnv } from "@/lib/env";
import { getSessionMode } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Whisky Advisor",
  description: "A private whisky collection, tasting, and recommendation app."
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  assertProductionEnv();
  const sessionMode = await getSessionMode();

  const navItems =
    sessionMode === "owner"
      ? [
          { href: "/", label: "Dashboard" },
          { href: "/collection", label: "Collection" },
          { href: "/add", label: "Add Bottle" },
          { href: "/analytics", label: "Analytics" },
          { href: "/advisor", label: "Advisor" },
          { href: "/tastings", label: "Tastings" },
          { href: "/compare", label: "Compare" },
          { href: "/export", label: "Export" },
          { href: "/news", label: "News" }
        ]
      : [
          { href: "/collection", label: "Collection" },
          { href: "/news", label: "News" }
        ];

  return (
    <html lang="en">
      <body>
        <NavigationFeedbackProvider>
          <div className="app-shell">
            <TopNav items={navItems} />
            <main className="main-content">{children}</main>
          </div>
        </NavigationFeedbackProvider>
      </body>
    </html>
  );
}
