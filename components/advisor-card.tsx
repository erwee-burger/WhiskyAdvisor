import type { AdvisorSuggestion } from "@/lib/types";
import { PendingLink } from "@/components/navigation-feedback";

export function AdvisorCard({ suggestion }: { suggestion: AdvisorSuggestion }) {
  return (
    <article className="advisor-card">
      <div className="advisor-card-head">
        <div className="advisor-card-copy">
          <h3>{suggestion.title}</h3>
          <div className="advisor-score-row">
            <div className="advisor-score-bar" aria-hidden="true">
              <div
                className="advisor-score-fill"
                style={{ width: `${suggestion.score}%` }}
              />
            </div>
            <span className="advisor-score-label">{suggestion.score}/100</span>
          </div>
        </div>
        <PendingLink className="button-subtle" href={`/collection/${suggestion.itemId}`}>
          Open
        </PendingLink>
      </div>

      {suggestion.rationale && (
        <p className="advisor-card-rationale">{suggestion.rationale}</p>
      )}

      {suggestion.supportingTags.length > 0 && (
        <div className="pill-row">
          {suggestion.supportingTags.map((tag) => (
            <span className="pill pill-flavour" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
