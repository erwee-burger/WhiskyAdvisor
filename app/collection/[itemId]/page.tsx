import { notFound } from "next/navigation";

import { BottleChat } from "@/components/bottle-chat";
import { BottleRating } from "@/components/bottle-rating";
import { BottleRecordEditor } from "@/components/bottle-record-editor";
import { getItemById } from "@/lib/repository";

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

  return (
    <div className="page">
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
