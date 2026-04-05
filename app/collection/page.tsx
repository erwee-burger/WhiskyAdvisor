import { CollectionBrowser } from "@/components/collection-browser";
import { getCollectionView } from "@/lib/repository";

export default async function CollectionPage() {
  const collection = await getCollectionView();

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
      <CollectionBrowser collection={collection} />
    </div>
  );
}
