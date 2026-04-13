import { Suspense } from "react";

import { CollectionBrowser } from "@/components/collection-browser";
import { getCollectionView } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function CollectionPage({
  searchParams
}: {
  searchParams?: Promise<{ notice?: string }>;
}) {
  const collection = await getCollectionView();
  const params = (await searchParams) ?? {};

  return (
    <div className="page">
      <section className="hero collection-hero">
        <p className="eyebrow">Collection</p>
        <h1>Walk the shelf like you are choosing your next pour.</h1>
        <p>
          Dark wood, back-bar glow, and bottle-first browsing. Search by distillery, region, release
          series, or your flavor tags while quick details appear on hover.
        </p>
      </section>
      {params.notice === "deleted" ? (
        <div className="status-note status-note-success">
          Bottle deleted from your collection.
        </div>
      ) : null}
      <Suspense fallback={<span className="loading-spinner" aria-hidden="true" />}>
        <CollectionBrowser collection={collection} />
      </Suspense>
    </div>
  );
}
