import { SOURCE_LABELS } from "@/lib/news-sources";
import type { NewsSummaryCard } from "@/lib/types";

const CARD_LABELS: Record<NewsSummaryCard["cardType"], string> = {
  best_value: "Best value",
  worth_stretching: "Worth the stretch",
  most_interesting: "Most interesting"
};

interface Props {
  cards: NewsSummaryCard[];
}

function formatPrice(price: number) {
  return `R ${price.toLocaleString("en-ZA")}`;
}

function IntelCard({ card }: { card: NewsSummaryCard }) {
  const label = CARD_LABELS[card.cardType];
  const cssClass = `intel-card ${card.cardType.replace("_", "-")}`;

  const inner = (
    <>
      <span className="intel-card-label">{label}</span>
      <div className="intel-card-title">{card.title}</div>
      {card.subtitle && <div className="intel-card-sub">{card.subtitle}</div>}
      {card.price && <div className="intel-card-price">{formatPrice(card.price)}</div>}
      {card.source && (
        <div className="intel-card-retailer">
          {SOURCE_LABELS[card.source] || card.source}
        </div>
      )}
    </>
  );

  if (card.url) {
    return (
      <a
        href={card.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cssClass}
      >
        {inner}
      </a>
    );
  }

  return <div className={cssClass}>{inner}</div>;
}

export function NewsSummaryCards({ cards }: Props) {
  if (cards.length === 0) return null;

  const order: NewsSummaryCard["cardType"][] = [
    "best_value",
    "worth_stretching",
    "most_interesting"
  ];
  const sorted = order
    .map(t => cards.find(c => c.cardType === t))
    .filter(Boolean) as NewsSummaryCard[];

  return (
    <div className="intel-grid">
      {sorted.map(card => (
        <IntelCard key={card.cardType} card={card} />
      ))}
    </div>
  );
}
