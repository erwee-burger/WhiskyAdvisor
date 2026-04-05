import Link from "next/link";

import type { AdvisorSuggestion } from "@/lib/types";

export function AdvisorCard({ suggestion }: { suggestion: AdvisorSuggestion }) {
  return (
    <article className="advisor-card">
      <div className="section-title">
        <div>
          <h3>{suggestion.title}</h3>
          <p>Advisor score {suggestion.score}/100</p>
        </div>
        <Link className="button-subtle" href={`/collection/${suggestion.itemId}`}>
          Open
        </Link>
      </div>
      <p>{suggestion.rationale}</p>
      <div className="pill-row">
        {suggestion.supportingTags.map((tag) => (
          <span className="pill" key={tag}>
            {tag}
          </span>
        ))}
      </div>
    </article>
  );
}
