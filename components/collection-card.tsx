import Image from "next/image";

import { PendingLink } from "@/components/navigation-feedback";
import { getBottleDisplayImage } from "@/lib/bottle-image";
import { getCaskStyleTags, getPeatTag, isIndependentBottler, isLimited, isNas } from "@/lib/tags";
import type { CollectionViewItem } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function CollectionCard({
  entry,
  interactive = false
}: {
  entry: CollectionViewItem;
  interactive?: boolean;
}) {
  const subtitleParts = [entry.expression.brand, entry.expression.distilleryName, entry.expression.bottlerName]
    .filter(Boolean)
    .map((value) => String(value).trim());
  const subtitle = Array.from(new Set(subtitleParts)).join(" / ");
  const bottleImage = getBottleDisplayImage(entry.expression.name, entry.images);
  const highlightTags = [
    getPeatTag(entry.expression.tags),
    ...getCaskStyleTags(entry.expression.tags).slice(0, 2),
    isIndependentBottler(entry.expression.tags) ? "independent-bottler" : null,
    isNas(entry.expression.tags) ? "nas" : null,
    isLimited(entry.expression.tags) ? "limited" : null
  ]
    .filter(Boolean)
    .map((tag) => String(tag));

  return (
    <PendingLink
      className={`shelf-bottle${interactive ? " shelf-bottle-interactive" : ""}`}
      href={`/collection/${entry.item.id}`}
    >
      <div className="bottle-glow" />
      <div className="bottle-cutout-wrap">
        <Image
          alt={`${entry.expression.name} bottle`}
          className="bottle-cutout"
          src={bottleImage}
          unoptimized
          width={130}
          height={220}
        />
      </div>

      <div className="shelf-bottle-copy">
        <h3>{entry.expression.name}</h3>
        <p>{subtitle}</p>
      </div>

      <div className="shelf-popup">
        <div className="shelf-popup-header">
          <div>
            <strong>{entry.expression.name}</strong>
            <p>{subtitle}</p>
          </div>
          <span className="shelf-popup-status">{entry.item.fillState}</span>
        </div>
        <div className="pill-row">
          {highlightTags.length > 0 ? (
            highlightTags.map((tag) => (
              <span className="pill" key={tag}>
                {tag}
              </span>
            ))
          ) : (
            <span className="pill">No tags yet</span>
          )}
        </div>
        <p className="shelf-popup-text">
          {entry.item.purchasePrice
            ? `Paid ${formatCurrency(entry.item.purchasePrice, entry.item.purchaseCurrency)}`
            : "Purchase price not saved"}
        </p>
        <p className="shelf-popup-link">Open bottle record</p>
      </div>
    </PendingLink>
  );
}
