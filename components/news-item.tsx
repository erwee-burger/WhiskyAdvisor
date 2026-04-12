// components/news-item.tsx
import Image from "next/image";
import { SOURCE_LABELS } from "@/lib/news-sources";
import type { BudgetFit } from "@/lib/types";

interface Props {
  name: string;
  price: number;
  originalPrice?: number;
  discountPct?: number;
  url: string;
  imageUrl?: string;
  kind: "special" | "new_release";
  budgetFit: BudgetFit;
  whyItMatters: string | null;
  source: string;
}

const BUDGET_BADGE_LABELS: Record<BudgetFit, string> = {
  in_budget:    "In budget",
  stretch:      "Stretch",
  over_budget:  "Over budget",
  above_budget: "Above budget"
};

function BudgetBadge({ fit }: { fit: BudgetFit }) {
  return (
    <span
      className={`news-item__budget-badge news-item__budget-badge--${fit.replace("_", "-")}`}
      aria-label={BUDGET_BADGE_LABELS[fit]}
    >
      {BUDGET_BADGE_LABELS[fit]}
    </span>
  );
}

function formatPrice(price: number) {
  return `R${price.toLocaleString("en-ZA")}`;
}

export function NewsItem({
  name, price, originalPrice, discountPct, url, imageUrl,
  kind, budgetFit, whyItMatters, source
}: Props) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="news-item"
    >
      {imageUrl && (
        <div className="news-item__image">
          <Image src={imageUrl} alt={name} fill style={{ objectFit: "contain" }} unoptimized />
        </div>
      )}
      <div className="news-item__body">
        <p className="news-item__source">{SOURCE_LABELS[source] ?? source}</p>
        <p className="news-item__name">{name}</p>
        <p className="news-item__price">{formatPrice(price)}</p>
        {originalPrice && (
          <p className="news-item__original">was {formatPrice(originalPrice)}</p>
        )}
        {discountPct && (
          <p className="news-item__discount">-{discountPct}%</p>
        )}
        {kind === "new_release" && (
          <p className="news-item__badge">NEW</p>
        )}
        <BudgetBadge fit={budgetFit} />
        {whyItMatters && (
          <p className="news-item__reason">{whyItMatters}</p>
        )}
      </div>
    </a>
  );
}
