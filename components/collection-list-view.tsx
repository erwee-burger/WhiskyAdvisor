"use client";

import Image from "next/image";

import { PendingLink } from "@/components/navigation-feedback";
import { StarRating } from "@/components/star-rating";
import { getBottleDisplayImage } from "@/lib/bottle-image";
import { formatTagLabel, getAllCaskTags, getPeatTag, isIndependentBottler, isLimited, isNas } from "@/lib/tags";
import type { CollectionViewItem } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

function formatFillStateLabel(fillState: CollectionViewItem["item"]["fillState"]) {
  return fillState.charAt(0).toUpperCase() + fillState.slice(1);
}

function formatStatusLabel(status: CollectionViewItem["item"]["status"]) {
  return status === "owned" ? "Owned" : "Wishlist";
}

function buildSubtitle(entry: CollectionViewItem) {
  const subtitleParts = [entry.expression.brand, entry.expression.distilleryName, entry.expression.bottlerName]
    .filter(Boolean)
    .map((value) => String(value).trim());

  return Array.from(new Set(subtitleParts)).join(" / ");
}

function buildHighlightTags(entry: CollectionViewItem) {
  return [
    getPeatTag(entry.expression.tags),
    ...getAllCaskTags(entry.expression.tags).slice(0, 2),
    isIndependentBottler(entry.expression.tags) ? "independent-bottler" : null,
    isNas(entry.expression.tags) ? "nas" : null,
    isLimited(entry.expression.tags) ? "limited" : null
  ]
    .filter(Boolean)
    .map((tag) => String(tag))
    .slice(0, 5);
}

function formatAbv(abv?: number) {
  return abv === undefined ? "Unknown" : `${abv}%`;
}

function formatAge(ageStatement?: number) {
  return ageStatement === undefined ? "NAS" : `${ageStatement} years`;
}

function CollectionListRow({ entry }: { entry: CollectionViewItem }) {
  const subtitle = buildSubtitle(entry);
  const highlightTags = buildHighlightTags(entry);
  const bottleImage = getBottleDisplayImage(entry.expression.name, entry.images);

  return (
    <PendingLink className="collection-list-row" href={`/collection/${entry.item.id}`}>
      <div className="collection-list-media">
        <div className="collection-list-image-shell">
          <Image
            alt={`${entry.expression.name} bottle`}
            className="collection-list-image"
            height={180}
            src={bottleImage}
            unoptimized
            width={88}
          />
        </div>
      </div>

      <div className="collection-list-primary">
        <div className="collection-list-topline">
          <div className="pill-row collection-list-state-pills">
            <span className="pill">{formatStatusLabel(entry.item.status)}</span>
            <span className="pill">{formatFillStateLabel(entry.item.fillState)}</span>
            {entry.expression.country ? <span className="pill">{entry.expression.country}</span> : null}
          </div>
          <StarRating isFavorite={entry.item.isFavorite} rating={entry.item.rating} size="sm" />
        </div>

        <div className="collection-list-heading">
          <h3>{entry.expression.name}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>

        <div className="collection-list-facts">
          <div className="collection-list-fact">
            <span className="collection-list-fact-label">ABV</span>
            <strong>{formatAbv(entry.expression.abv)}</strong>
          </div>
          <div className="collection-list-fact">
            <span className="collection-list-fact-label">Age</span>
            <strong>{formatAge(entry.expression.ageStatement)}</strong>
          </div>
          <div className="collection-list-fact">
            <span className="collection-list-fact-label">Paid</span>
            <strong>
              {entry.item.purchasePrice
                ? formatCurrency(entry.item.purchasePrice, entry.item.purchaseCurrency)
                : "Not saved"}
            </strong>
          </div>
          <div className="collection-list-fact">
            <span className="collection-list-fact-label">Source</span>
            <strong>{entry.item.purchaseSource ?? "Unknown"}</strong>
          </div>
          <div className="collection-list-fact">
            <span className="collection-list-fact-label">Bought</span>
            <strong>{entry.item.purchaseDate ? formatDate(entry.item.purchaseDate) : "Not set"}</strong>
          </div>
        </div>

        <div className="pill-row collection-list-tag-row">
          {highlightTags.length > 0 ? (
            highlightTags.map((tag) => (
              <span className="pill" key={tag}>
                {formatTagLabel(tag)}
              </span>
            ))
          ) : (
            <span className="pill">No tags yet</span>
          )}
        </div>
      </div>
    </PendingLink>
  );
}

export function CollectionListView({ entries }: { entries: CollectionViewItem[] }) {
  return (
    <div className="collection-list">
      {entries.map((entry) => (
        <CollectionListRow entry={entry} key={entry.item.id} />
      ))}
    </div>
  );
}
