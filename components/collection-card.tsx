import Link from "next/link";
import Image from "next/image";

import { getBottleDisplayImage } from "@/lib/bottle-image";
import type { CollectionViewItem } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function CollectionCard({
  entry,
  interactive = false
}: {
  entry: CollectionViewItem;
  interactive?: boolean;
}) {
  const currentPrice = entry.priceSnapshot?.retail;
  const subtitle = `${entry.distillery.name} / ${entry.bottler.name}`;
  const retailRange = currentPrice
    ? `${formatCurrency(currentPrice.low, currentPrice.currency)} - ${formatCurrency(currentPrice.high, currentPrice.currency)}`
    : "No web pricing yet";
  const bottleImage = getBottleDisplayImage(entry.expression.name, entry.images);

  return (
    <Link
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
          <span className="pill">Peat {entry.expression.peatLevel}</span>
          <span className="pill">Cask {entry.expression.caskInfluence}</span>
          <span className="pill">{entry.expression.bottlerKind}</span>
          {entry.expression.releaseSeries ? <span className="pill">{entry.expression.releaseSeries}</span> : null}
        </div>
        <p className="shelf-popup-text">
          {entry.item.purchasePrice
            ? `Paid ${formatCurrency(entry.item.purchasePrice, entry.item.purchaseCurrency)}`
            : "Purchase price not saved"}
        </p>
        <p className="shelf-popup-text">Retail now {retailRange}</p>
        <p className="shelf-popup-link">Open bottle record</p>
      </div>
    </Link>
  );
}
