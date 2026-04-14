import { AdvisorChat } from "@/components/advisor-chat";
import { AdvisorInsights } from "@/components/advisor-insights";
import { getCollectionDashboard } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function AdvisorPage() {
  const { profile, drinkNow, buyNext } = await getCollectionDashboard();

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Advisor</p>
        <h1>Your collection, talking back.</h1>
        <p>
          Ask anything about what to open tonight, what to bring to whisky Friday, what your
          family has not tasted in a while, or what your palate actually looks like. Your
          advisor knows your shelf and your shared history.
        </p>
      </section>

      <AdvisorChat />

      <AdvisorInsights profile={profile} drinkNow={drinkNow} buyNext={buyNext} />
    </div>
  );
}
