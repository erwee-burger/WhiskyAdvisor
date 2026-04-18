import { SOURCE_LABELS } from "@/lib/news-sources";
import type { BudgetFit, NewsAffinity, NewsFeedItem } from "@/lib/types";

interface Props {
  item: NewsFeedItem;
  showBudget: boolean;
  affinity: NewsAffinity | null;
  reasonTags: string[];
  signalLabel: string;
  saveAmount?: number;
  visitState?: "new_to_you" | "seen";
}

const BUDGET_LABELS: Record<BudgetFit, string> = {
  in_budget: "In budget",
  stretch: "Stretch",
  over_budget: "Over budget",
  above_budget: "Above budget"
};

function formatPrice(price: number) {
  return `R ${price.toLocaleString("en-ZA")}`;
}

function palateFitLabel(affinity: NewsAffinity): string {
  if (affinity.band === "strong_fit") return "Palate fit: strong";
  if (affinity.band === "good_fit") return "Palate fit: good";
  return "Palate fit: outside lane";
}

export function NewsItem({ item, showBudget, affinity, reasonTags, signalLabel, saveAmount, visitState }: Props) {
  const badgeClass = `news-card-badge news-card-badge-${item.budgetFit.replace("_", "-")}`;
  const visitBadgeClass = visitState === "new_to_you"
    ? "news-card-badge news-card-badge-fresh"
    : "news-card-badge news-card-badge-seen";
  const visitLabel = visitState === "new_to_you" ? "New to you" : "Seen";
  const cardClassName = visitState === "new_to_you" ? "news-card news-card--fresh" : "news-card";
  const fitClassName = affinity ? `news-card-signal news-card-signal-fit-${affinity.band.replace(/_/g, "-")}` : "";
  const highlightCopy =
    item.kind === "new_release"
      ? item.whyItMatters
      : saveAmount
        ? `Save ${formatPrice(saveAmount)} versus the original shelf price.`
        : item.whyItMatters;

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cardClassName}
      data-kind={item.kind}
    >
      <div className="news-card-top">
        <span className="news-card-retailer">{SOURCE_LABELS[item.source] || item.source}</span>
        <div className="news-card-badges">
          {visitState && <span className={visitBadgeClass}>{visitLabel}</span>}
          {showBudget && <span className={badgeClass}>{BUDGET_LABELS[item.budgetFit]}</span>}
        </div>
      </div>

      {item.imageUrl ? (
        <div className="news-card-media">
          <img src={item.imageUrl} alt={item.name} loading="lazy" />
        </div>
      ) : null}

      <div className="news-card-signals">
        <span className={`news-card-signal ${item.kind === "special" ? "news-card-signal-deal" : "news-card-signal-release"}`}>
          {signalLabel}
        </span>
        {affinity ? <span className={fitClassName}>{palateFitLabel(affinity)}</span> : null}
      </div>

      <div className="news-card-name">{item.name}</div>

      <div className="news-card-price-row">
        <span className="news-card-price">{formatPrice(item.price)}</span>
        {item.originalPrice && <span className="news-card-original">{formatPrice(item.originalPrice)}</span>}
        {item.discountPct ? <span className="news-card-discount">-{item.discountPct}%</span> : null}
      </div>

      {highlightCopy ? <div className="news-card-highlight">{highlightCopy}</div> : null}

      {reasonTags.length > 0 ? (
        <div className="news-card-tags">
          {reasonTags.map((tag) => (
            <span key={tag} className="news-card-tag">{tag}</span>
          ))}
        </div>
      ) : null}

      {item.kind === "special" && item.whyItMatters ? (
        <div className="news-card-reason">{item.whyItMatters}</div>
      ) : null}
    </a>
  );
}
