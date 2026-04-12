// components/news-summary-cards.tsx
import type { NewsSummaryCard } from "@/lib/types";
import { SOURCE_LABELS } from "@/lib/news-sources";

const CARD_LABELS: Record<NewsSummaryCard["cardType"], string> = {
  best_value:       "Best value today",
  worth_stretching: "Worth stretching for",
  most_interesting: "Most interesting new arrival"
};

interface Props {
  cards: NewsSummaryCard[];
}

function formatPrice(price: number) {
  return `R${price.toLocaleString("en-ZA")}`;
}

function SummaryCard({ card }: { card: NewsSummaryCard }) {
  const label = CARD_LABELS[card.cardType];
  const inner = (
    <div className="news-summary-card__inner">
      <p className="news-summary-card__label">{label}</p>
      <p className="news-summary-card__title">{card.title}</p>
      {card.subtitle && (
        <p className="news-summary-card__subtitle">{card.subtitle}</p>
      )}
      {card.price && (
        <p className="news-summary-card__price">{formatPrice(card.price)}</p>
      )}
      {card.source && (
        <p className="news-summary-card__source">
          {SOURCE_LABELS[card.source] ?? card.source}
        </p>
      )}
      {card.whyItMatters && (
        <p className="news-summary-card__reason">{card.whyItMatters}</p>
      )}
    </div>
  );

  if (card.url) {
    return (
      <a
        href={card.url}
        target="_blank"
        rel="noopener noreferrer"
        className="news-summary-card news-summary-card--link"
      >
        {inner}
      </a>
    );
  }

  return <div className="news-summary-card">{inner}</div>;
}

export function NewsSummaryCards({ cards }: Props) {
  if (cards.length === 0) return null;

  // Render in canonical order regardless of DB row order
  const order: NewsSummaryCard["cardType"][] = [
    "best_value",
    "worth_stretching",
    "most_interesting"
  ];
  const sorted = order
    .map(t => cards.find(c => c.cardType === t))
    .filter(Boolean) as NewsSummaryCard[];

  return (
    <div className="news-summary-cards">
      {sorted.map(card => (
        <SummaryCard key={card.cardType} card={card} />
      ))}
    </div>
  );
}
