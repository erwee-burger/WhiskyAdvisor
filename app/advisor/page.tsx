import { AdvisorCard } from "@/components/advisor-card";
import { ProfileCard } from "@/components/profile-card";
import { getAdvisor, getPalateProfile } from "@/lib/repository";

export default async function AdvisorPage() {
  const [profile, drinkNow, buyNext] = await Promise.all([
    getPalateProfile(),
    getAdvisor("drink-now"),
    getAdvisor("buy-next")
  ]);

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Advisor</p>
        <h1>A whisky advisor trained by your own notes.</h1>
        <p>
          Your palate profile is visible, explainable, and used directly to decide which bottles you
          should open now and which ones deserve a place on the shelf next.
        </p>
      </section>

      <section className="panel stack">
        <div className="section-title">
          <div>
            <h2>Palate profile</h2>
            <p>The cards below are inferred from your confirmed tastings.</p>
          </div>
        </div>
        <div className="grid columns-2">
          {profile.cards.map((card) => (
            <ProfileCard card={card} key={card.title} />
          ))}
        </div>
      </section>

      <section className="grid columns-2">
        <div className="panel stack">
          <div className="section-title">
            <div>
              <h2>Drink now</h2>
              <p>Open bottles and current owned drams ranked for today.</p>
            </div>
          </div>
          <div className="card-list">
            {drinkNow.map((suggestion) => (
              <AdvisorCard key={suggestion.itemId} suggestion={suggestion} />
            ))}
          </div>
        </div>
        <div className="panel stack">
          <div className="section-title">
            <div>
              <h2>Buy next</h2>
              <p>Wishlist bottles that fit your current palate pattern.</p>
            </div>
          </div>
          <div className="card-list">
            {buyNext.map((suggestion) => (
              <AdvisorCard key={suggestion.itemId} suggestion={suggestion} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
