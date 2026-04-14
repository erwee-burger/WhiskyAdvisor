import { notFound } from "next/navigation";

import { BottleSharingHistory } from "@/components/bottle-sharing-history";
import { BottleChat } from "@/components/bottle-chat";
import { BottleRating } from "@/components/bottle-rating";
import { BottleRecordEditor } from "@/components/bottle-record-editor";
import {
  getBottleSocialSummary,
  getItemById,
  getTastingGroups,
  getTastingPeople,
  getTastingPlaces
} from "@/lib/repository";
import { getSessionMode } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ItemDetailPage({
  params
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  const [entry, sessionMode] = await Promise.all([
    getItemById(itemId),
    getSessionMode()
  ]);

  if (!entry) {
    notFound();
  }

  const isOwner = sessionMode === "owner";
  const canQuickShare = entry.item.status === "owned" && entry.item.fillState !== "finished";
  const [socialSummary, people, groups, places] = isOwner
    ? await Promise.all([
        getBottleSocialSummary(itemId),
        getTastingPeople(),
        getTastingGroups(),
        getTastingPlaces()
      ])
    : [null, [], [], []];

  return (
    <div className="page">
      <BottleRecordEditor entry={entry} isOwner={isOwner} />

      {isOwner && (
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
      )}

      {isOwner && (
        <BottleSharingHistory
          canQuickShare={canQuickShare}
          itemId={entry.item.id}
          summary={socialSummary!}
          people={people}
          groups={groups}
          places={places}
        />
      )}

      {isOwner && (
        <BottleChat bottleId={entry.item.id} bottleName={entry.expression.name} />
      )}
    </div>
  );
}
