import type { FlavorPillar } from "@/lib/types";

const PILLAR_ORDER: FlavorPillar[] = [
  "smoky", "sweet", "spicy", "fruity", "oaky", "floral", "malty", "coastal"
];

export function FlavorBarGrid({ pillars }: { pillars: Record<FlavorPillar, number> }) {
  return (
    <div className="flavor-bar-grid">
      {PILLAR_ORDER.map((pillar) => {
        const value = pillars[pillar] ?? 0;
        return (
          <div className="flavor-bar-row" key={pillar}>
            <div className="flavor-bar-header">
              <span className="flavor-bar-label">{pillar}</span>
              <span className="flavor-bar-value">{value}/10</span>
            </div>
            <div className="flavor-bar-track">
              <div className="flavor-bar-fill" style={{ width: `${value * 10}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
