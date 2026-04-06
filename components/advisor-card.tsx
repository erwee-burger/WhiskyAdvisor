import type { AdvisorSuggestion } from "@/lib/types";
import { PendingLink } from "@/components/navigation-feedback";

export function AdvisorCard({ suggestion }: { suggestion: AdvisorSuggestion }) {
  return (
    <article className="advisor-card">
      <div className="section-title">
        <div>
          <h3>{suggestion.title}</h3>
          <p>Advisor score {suggestion.score}/100</p>
        </div>
        <PendingLink className="button-subtle" href={`/collection/${suggestion.itemId}`}>
          Open
        </PendingLink>
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
