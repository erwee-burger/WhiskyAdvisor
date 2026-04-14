import type { NewsFeedItem, BudgetFit } from "@/lib/types";

interface Props {
  item: NewsFeedItem;
  kind: "special" | "new_release";
  showBudget: boolean;
  visitState?: "new_to_you" | "seen";
}

const RETAILER_LABELS: Record<string, string> = {
  whiskybrother: "Whisky Brother",
  bottegawhiskey: "Bottega Whiskey",
  mothercityliquor: "Mother City Liquor",
  whiskyemporium: "Whisky Emporium",
  normangoodfellows: "Norman Goodfellows"
};

const BUDGET_LABELS: Record<BudgetFit, string> = {
  in_budget: "In budget",
  stretch: "Stretch",
  over_budget: "Over budget",
  above_budget: "Above budget"
};

function formatPrice(price: number) {
  return `R ${price.toLocaleString("en-ZA")}`;
}

export function NewsItem({ item, kind, showBudget, visitState }: Props) {
  const badgeClass = `news-card-badge news-card-badge-${item.budgetFit.replace("_", "-")}`;
  const visitBadgeClass = visitState === "new_to_you"
    ? "news-card-badge news-card-badge-fresh"
    : "news-card-badge news-card-badge-seen";
  const visitLabel = visitState === "new_to_you" ? "New to you" : "Seen";
  const cardClassName = visitState === "new_to_you" ? "news-card news-card--fresh" : "news-card";

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cardClassName}
      data-kind={kind}
    >
      {/* Header: retailer badge and badges */}
      <div className="news-card-top">
        <span className="news-card-retailer">{RETAILER_LABELS[item.source] || item.source}</span>
        <div className="news-card-badges">
          {visitState && <span className={visitBadgeClass}>{visitLabel}</span>}
          {showBudget && <span className={badgeClass}>{BUDGET_LABELS[item.budgetFit]}</span>}
        </div>
      </div>

      {/* Product name */}
      <div className="news-card-name">{item.name}</div>

      {/* Price and discount */}
      <div className="news-card-price-row">
        <span className="news-card-price">{formatPrice(item.price)}</span>
        {item.originalPrice && <span className="news-card-original">{formatPrice(item.originalPrice)}</span>}
        {item.discountPct && <span className="news-card-discount">−{item.discountPct}%</span>}
      </div>

      {/* GPT rationale */}
      {item.whyItMatters && (
        <div className="news-card-reason">"{item.whyItMatters}"</div>
      )}
    </a>
  );
}
