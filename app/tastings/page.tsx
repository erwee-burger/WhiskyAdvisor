import { TastingsHub } from "@/components/tastings-hub";
import { getTastingsPageData } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function TastingsPage() {
  const data = await getTastingsPageData();

  return (
    <div className="page">
      <TastingsHub
        recentSessions={data.recentSessions}
        people={data.people}
        groups={data.groups}
        places={data.places}
        availableBottles={data.availableBottles}
      />
    </div>
  );
}
