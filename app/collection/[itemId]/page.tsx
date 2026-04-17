import { notFound } from "next/navigation";

import { BottleSharingHistory } from "@/components/bottle-sharing-history";
import { BottleChat } from "@/components/bottle-chat";
import { BottleRating } from "@/components/bottle-rating";
import { BottleRecordEditor } from "@/components/bottle-record-editor";
import type { ExpressionFlavorProfile, TastingGroup, TastingPerson, TastingPlace } from "@/lib/types";
import {
  getBottleSocialSummary,
  getExpressionFlavorProfileByItemId,
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
  let socialSummary = null;
  let flavorProfile: ExpressionFlavorProfile | null = null;
  let people: TastingPerson[] = [];
  let groups: TastingGroup[] = [];
  let places: TastingPlace[] = [];

  if (isOwner) {
    [socialSummary, flavorProfile, people, groups, places] = await Promise.all([
      getBottleSocialSummary(itemId),
      getExpressionFlavorProfileByItemId(itemId),
      getTastingPeople(),
      getTastingGroups(),
      getTastingPlaces()
    ]);
  }

  return (
    <div className="page">
      <BottleRecordEditor entry={entry} flavorProfile={flavorProfile} isOwner={isOwner} />

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
