import { notFound } from "next/navigation";
import Image from "next/image";

import { BottleChat } from "@/components/bottle-chat";
import { BottleRating } from "@/components/bottle-rating";
import { BottleRecordEditor } from "@/components/bottle-record-editor";
import { getBottleDisplayImage } from "@/lib/bottle-image";
import { getItemById } from "@/lib/repository";
import {
  getCaskStyleTags,
  getPeatTag,
  isChillFiltered,
  isIndependentBottler,
  isLimited,
  isNas,
  isNaturalColour
} from "@/lib/tags";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ItemDetailPage({
  params
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  const entry = await getItemById(itemId);

  if (!entry) {
    notFound();
  }

  const bottleImage = getBottleDisplayImage(entry.expression.name, entry.images);
  const tags = entry.expression.tags ?? [];
  const caskTags = getCaskStyleTags(tags);
  const signalTags = [
    getPeatTag(tags),
    ...caskTags.slice(0, 2),
    isIndependentBottler(tags) ? "independent-bottler" : null,
    isNas(tags) ? "nas" : null,
    isChillFiltered(tags) ? "chill-filtered" : null,
    isNaturalColour(tags) ? "natural-colour" : null,
    isLimited(tags) ? "limited" : null
  ]
    .filter(Boolean)
    .map((tag) => String(tag));

  return (
    <div className="page">
      <section className="hero bottle-detail-hero">
        <div className="bottle-stand">
          <Image
            alt={`${entry.expression.name} bottle cutout`}
            src={bottleImage}
            unoptimized
            width={220}
            height={320}
          />
        </div>
        <div>
          <p className="eyebrow">Bottle Detail</p>
          <h1>{entry.expression.name}</h1>
          <p>
            {entry.expression.brand &&
            entry.expression.brand !== entry.expression.distilleryName &&
            entry.expression.brand !== entry.expression.bottlerName
              ? `${entry.expression.brand}. `
              : ""}
            {entry.expression.distilleryName ?? "Unknown distillery"} distilled it.{" "}
            {entry.expression.bottlerName ?? "Unknown bottler"} released it. This bottle is tracked in your
            cellar through its flat expression fields and tags.
          </p>
          <div className="pill-row">
            <span className="pill">{entry.expression.country}</span>
            {entry.expression.abv ? <span className="pill">{entry.expression.abv}% ABV</span> : null}
            <span className="pill">{entry.item.status}</span>
            <span className="pill">{entry.item.fillState}</span>
            <span className="pill">{isNas(tags) ? "NAS" : `${entry.expression.ageStatement ?? "Unknown"} years`}</span>
            <span className="pill">{isIndependentBottler(tags) ? "Independent" : "Official"}</span>
          </div>
          {signalTags.length > 0 ? (
            <div className="pill-row" style={{ marginTop: "12px" }}>
              {signalTags.map((tag) => (
                <span className="pill" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          <div className="grid columns-2" style={{ marginTop: "16px" }}>
            <div className="status-note">
              {entry.item.purchasePrice
                ? `Paid ${formatCurrency(entry.item.purchasePrice, entry.item.purchaseCurrency)}`
                : "No purchase price saved yet"}
            </div>
            <div className="status-note">
              {entry.expression.description ?? "No bottle description saved yet"}
            </div>
          </div>
        </div>
      </section>

      <section className="grid columns-2">
        <div className="panel stack">
          <div className="section-title">
            <div>
              <h2>Release details</h2>
              <p>Collector-grade fields for identity, tasting signals, and bottle context.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <tbody>
                <tr>
                  <th>Brand</th>
                  <td>{entry.expression.brand ?? "Not set"}</td>
                </tr>
                <tr>
                  <th>Distillery</th>
                  <td>{entry.expression.distilleryName ?? "Not set"}</td>
                </tr>
                <tr>
                  <th>Bottler</th>
                  <td>{entry.expression.bottlerName ?? "Not set"}</td>
                </tr>
                <tr>
                  <th>Country</th>
                  <td>{entry.expression.country}</td>
                </tr>
                <tr>
                  <th>Age statement</th>
                  <td>{isNas(tags) ? "NAS" : `${entry.expression.ageStatement ?? "Not set"}`}</td>
                </tr>
                <tr>
                  <th>Tags</th>
                  <td>{tags.join(", ") || "Not set"}</td>
                </tr>
                <tr>
                  <th>Production flags</th>
                  <td>
                    {[
                      isChillFiltered(tags) ? "Chill filtered" : null,
                      isNaturalColour(tags) ? "Natural colour" : null,
                      isLimited(tags) ? "Limited" : null
                    ]
                      .filter(Boolean)
                      .join(", ") || "None marked"}
                  </td>
                </tr>
                <tr>
                  <th>Purchase source</th>
                  <td>{entry.item.purchaseSource ?? "Not set"}</td>
                </tr>
                <tr>
                  <th>Purchase date</th>
                  <td>{formatDate(entry.item.purchaseDate)}</td>
                </tr>
                <tr>
                  <th>Collection note</th>
                  <td>{entry.item.personalNotes ?? "Not set"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel stack">
          <div className="section-title">
            <div>
              <h2>Bottle tags</h2>
              <p>The shelf signals used for search, filtering, and advisor logic.</p>
            </div>
          </div>
          <div className="pill-row">
            {tags.length > 0 ? (
              tags.map((tag) => (
                <span className="pill" key={tag}>
                  {tag}
                </span>
              ))
            ) : (
              <span className="pill">No tags set</span>
            )}
          </div>
          <div className="status-note">
            {entry.item.purchasePrice
              ? `Paid ${formatCurrency(entry.item.purchasePrice, entry.item.purchaseCurrency)}`
              : "No purchase price saved yet"}
          </div>
          <div className="status-note">{entry.expression.description ?? "No bottle description saved yet"}</div>
          <div className="status-note">
            {caskTags.length > 0 ? `Cask signals: ${caskTags.join(", ")}` : "No cask tags set"}
          </div>
        </div>
      </section>

      <BottleRecordEditor entry={entry} />

      <section className="panel stack">
        <div className="section-title">
          <div>
            <h2>My rating</h2>
            <p>Rate this bottle and mark it as a favorite if it stands out.</p>
          </div>
        </div>
        <BottleRating
          isFavorite={entry.item.isFavorite}
          itemId={entry.item.id}
          rating={entry.item.rating}
        />
      </section>

      <BottleChat bottleId={entry.item.id} bottleName={entry.expression.name} />
    </div>
  );
}
