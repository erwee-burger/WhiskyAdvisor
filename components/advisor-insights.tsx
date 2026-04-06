"use client";

import { useState } from "react";
import { AdvisorCard } from "@/components/advisor-card";
import { ProfileCard } from "@/components/profile-card";
import type { AdvisorSuggestion, PalateProfile } from "@/lib/types";

interface Props {
  profile: PalateProfile;
  drinkNow: AdvisorSuggestion[];
  buyNext: AdvisorSuggestion[];
}

export function AdvisorInsights({ profile, drinkNow, buyNext }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="panel stack">
      <button
        className="section-title"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        style={{ cursor: "pointer", background: "none", border: "none", width: "100%", textAlign: "left", padding: 0 }}
      >
        <div>
          <h2>{open ? "▼" : "▶"} Your profile &amp; picks</h2>
          <p>Palate profile cards and current advisor recommendations.</p>
        </div>
      </button>

      {open && (
        <>
          <div className="grid columns-2">
            {profile.cards.map((card) => (
              <ProfileCard card={card} key={card.title} />
            ))}
          </div>

          <div className="grid columns-2">
            <div className="stack">
              <h3>Drink now</h3>
              <div className="card-list">
                {drinkNow.map((suggestion) => (
                  <AdvisorCard key={suggestion.itemId} suggestion={suggestion} />
                ))}
              </div>
            </div>
            <div className="stack">
              <h3>Buy next</h3>
              <div className="card-list">
                {buyNext.map((suggestion) => (
                  <AdvisorCard key={suggestion.itemId} suggestion={suggestion} />
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
