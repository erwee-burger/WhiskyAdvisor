import type { PalateCard } from "@/lib/types";

export function ProfileCard({ card }: { card: PalateCard }) {
  return (
    <article className="profile-card">
      <p className="eyebrow">{card.title}</p>
      <h3>{card.value}</h3>
      <p className="muted">{card.supporting}</p>
    </article>
  );
}
