"use client";

import Image from "next/image";
import type { ReactNode } from "react";

import { getBottleDisplayImage } from "@/lib/bottle-image";
import type { CollectionViewItem, FlavorPillar } from "@/lib/types";

const PILLAR_ORDER: FlavorPillar[] = [
  "smoky", "sweet", "spicy", "fruity", "oaky", "floral", "malty", "coastal"
];

const BOTTLE_FILLS = [
  "linear-gradient(90deg, rgba(212, 157, 69, 0.45), rgba(212, 157, 69, 0.9))",
  "linear-gradient(90deg, rgba(108, 163, 189, 0.45), rgba(108, 163, 189, 0.9))",
  "linear-gradient(90deg, rgba(142, 185, 105, 0.45), rgba(142, 185, 105, 0.9))"
];

function getBottleSubline(entry: CollectionViewItem) {
  return [entry.expression.distilleryName, entry.expression.brand, entry.expression.bottlerName]
    .filter(Boolean)
    .map((v) => String(v).trim())
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(" / ");
}

export function FlavorComparisonGrid({ bottles }: { bottles: CollectionViewItem[] }) {
  if (bottles.length === 0) return null;

  const cols = bottles.length;
  const cells: ReactNode[] = [];

  // Corner spacer
  cells.push(<div className="fcp-corner" key="corner" />);

  // Column headers — bottle image + name + tasting notes
  bottles.forEach((bottle) => {
    const subline = getBottleSubline(bottle);
    const notes = bottle.expression.tastingNotes.slice(0, 5);
    cells.push(
      <div className="fcp-bottle-header" key={`header-${bottle.item.id}`}>
        <div className="fcp-bottle-image-wrap">
          <Image
            alt={bottle.expression.name}
            className="fcp-bottle-image"
            height={72}
            src={getBottleDisplayImage(bottle.expression.name, bottle.images)}
            unoptimized
            width={42}
          />
        </div>
        <div className="fcp-bottle-meta">
          <strong className="fcp-bottle-name">{bottle.expression.name}</strong>
          {subline ? <p className="fcp-bottle-subline">{subline}</p> : null}
        </div>
        {notes.length > 0 && (
          <div className="fcp-note-chips">
            {notes.map((note) => (
              <span className="fcp-note-chip" key={note}>{note}</span>
            ))}
          </div>
        )}
      </div>
    );
  });

  // Pillar rows
  PILLAR_ORDER.forEach((pillar) => {
    cells.push(
      <div className="fcp-pillar-label" key={`label-${pillar}`}>{pillar}</div>
    );
    bottles.forEach((bottle, i) => {
      const value = bottle.flavorProfile?.pillars[pillar] ?? 0;
      const hasProfile = Boolean(bottle.flavorProfile);
      cells.push(
        <div className={`fcp-bar-cell${!hasProfile ? " fcp-bar-cell-empty" : ""}`} key={`${pillar}-${bottle.item.id}`}>
          <div className="fcp-bar-track">
            <div
              className="fcp-bar-fill"
              style={{
                width: hasProfile ? `${value * 10}%` : "0%",
                background: BOTTLE_FILLS[i % BOTTLE_FILLS.length]
              }}
            />
          </div>
          <span className="fcp-bar-value">{hasProfile ? `${value}/10` : "–"}</span>
        </div>
      );
    });
  });

  return (
    <div className="fcp-scroll-wrap">
      <div
        className="fcp-grid"
        style={{ gridTemplateColumns: `72px repeat(${cols}, 160px)` }}
      >
        {cells}
      </div>
    </div>
  );
}
