import { notFound } from "next/navigation";
import Image from "next/image";

import { BottleRecordEditor } from "@/components/bottle-record-editor";
import { TastingForm } from "@/components/tasting-form";
import { getBottleDisplayImage } from "@/lib/bottle-image";
import { getItemById } from "@/lib/repository";
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
            entry.expression.brand !== entry.distillery.name &&
            entry.expression.brand !== entry.bottler.name
              ? `${entry.expression.brand}. `
              : ""}
            {entry.distillery.name} distilled it. {entry.bottler.name} released it. This bottle is tracked
            as an {entry.expression.bottlerKind} bottling in your cellar.
          </p>
          <div className="pill-row">
            <span className="pill">{entry.expression.region}</span>
            <span className="pill">{entry.expression.abv}% ABV</span>
            {entry.expression.volumeMl ? <span className="pill">{entry.expression.volumeMl} ml</span> : null}
            <span className="pill">{entry.item.status}</span>
            <span className="pill">{entry.item.fillState}</span>
            <span className="pill">{entry.expression.isNas ? "NAS" : `${entry.expression.ageStatement ?? "Unknown"} years`}</span>
            {entry.expression.isLimited ? <span className="pill">Limited</span> : null}
            {entry.expression.releaseSeries ? <span className="pill">{entry.expression.releaseSeries}</span> : null}
          </div>
          <div className="grid columns-2" style={{ marginTop: "16px" }}>
            <div className="status-note">
              {entry.item.purchasePrice
                ? `Paid ${formatCurrency(entry.item.purchasePrice, entry.item.purchaseCurrency)}`
                : "No purchase price saved yet"}
            </div>
            <div className="status-note">
              {entry.priceSnapshot?.retail
                ? `Retail now ${formatCurrency(entry.priceSnapshot.retail.low, entry.priceSnapshot.retail.currency)} to ${formatCurrency(entry.priceSnapshot.retail.high, entry.priceSnapshot.retail.currency)}`
                : "No pricing snapshot cached yet"}
            </div>
          </div>
        </div>
      </section>

      <section className="grid columns-2">
        <div className="panel stack">
          <div className="section-title">
            <div>
              <h2>Release details</h2>
              <p>Collector-grade fields for distillery identity and special releases.</p>
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
                  <td>{entry.distillery.name}</td>
                </tr>
                <tr>
                  <th>Bottler</th>
                  <td>{entry.bottler.name}</td>
                </tr>
                <tr>
                  <th>Bottler kind</th>
                  <td>{entry.expression.bottlerKind}</td>
                </tr>
                <tr>
                  <th>Release series</th>
                  <td>{entry.expression.releaseSeries ?? "Standard release"}</td>
                </tr>
                <tr>
                  <th>Age statement</th>
                  <td>{entry.expression.isNas ? "NAS" : `${entry.expression.ageStatement ?? "Not set"}`}</td>
                </tr>
                <tr>
                  <th>Bottle size</th>
                  <td>{entry.expression.volumeMl ? `${entry.expression.volumeMl} ml` : "Not set"}</td>
                </tr>
                <tr>
                  <th>Cask</th>
                  <td>{entry.expression.caskType ?? entry.expression.caskInfluence}</td>
                </tr>
                <tr>
                  <th>Cask number</th>
                  <td>{entry.expression.caskNumber ?? "Not set"}</td>
                </tr>
                <tr>
                  <th>Bottle number</th>
                  <td>{entry.expression.bottleNumber ?? "Not set"}</td>
                </tr>
                <tr>
                  <th>Outturn</th>
                  <td>{entry.expression.outturn ?? "Not set"}</td>
                </tr>
                <tr>
                  <th>Production flags</th>
                  <td>
                    {[
                      entry.expression.isChillFiltered ? "Chill filtered" : null,
                      entry.expression.isNaturalColor ? "Natural color" : null,
                      entry.expression.isLimited ? "Limited" : null
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
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel stack">
          <div className="section-title">
            <div>
              <h2>Pricing</h2>
              <p>Paid price versus current retail and auction context.</p>
            </div>
          </div>
          <div className="status-note">
            Paid:{" "}
            {entry.item.purchasePrice
              ? formatCurrency(entry.item.purchasePrice, entry.item.purchaseCurrency)
              : "Not captured"}
          </div>
          <div className="status-note">
            Retail:
            {" "}
            {entry.priceSnapshot?.retail
              ? `${formatCurrency(entry.priceSnapshot.retail.low, entry.priceSnapshot.retail.currency)} - ${formatCurrency(entry.priceSnapshot.retail.high, entry.priceSnapshot.retail.currency)}`
              : "No range yet"}
          </div>
          <div className="status-note">
            Auction:
            {" "}
            {entry.priceSnapshot?.auction
              ? `${formatCurrency(entry.priceSnapshot.auction.low, entry.priceSnapshot.auction.currency)} - ${formatCurrency(entry.priceSnapshot.auction.high, entry.priceSnapshot.auction.currency)}`
              : "No range yet"}
          </div>
          <div className="pill-row">
            {entry.expression.flavorTags.map((tag) => (
              <span className="pill" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      <BottleRecordEditor entry={entry} />

      <section className="grid columns-2">
        <div className="panel stack">
          <div className="section-title">
            <div>
              <h2>Tasting history</h2>
              <p>Save structured notes over time as the bottle evolves.</p>
            </div>
          </div>
          <div className="card-list">
            {entry.tastingEntries.length > 0 ? (
              entry.tastingEntries.map((note) => (
                <article className="advisor-card" key={note.id}>
                  <div className="section-title">
                    <div>
                      <h3>{formatDate(note.tastedAt)}</h3>
                      <p>{note.rating}/5</p>
                    </div>
                  </div>
                  <p>
                    <strong>Nose:</strong> {note.nose}
                  </p>
                  <p>
                    <strong>Palate:</strong> {note.palate}
                  </p>
                  <p>
                    <strong>Finish:</strong> {note.finish}
                  </p>
                  <p className="muted">{note.overallNote}</p>
                </article>
              ))
            ) : (
              <div className="empty-state">No tasting notes yet.</div>
            )}
          </div>
        </div>

        <div className="panel stack">
          <div className="section-title">
            <div>
              <h2>Add tasting note</h2>
              <p>Structured notes feed both analytics and advisor scoring.</p>
            </div>
          </div>
          <TastingForm itemId={entry.item.id} />
        </div>
      </section>
    </div>
  );
}
