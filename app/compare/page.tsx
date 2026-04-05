import { CompareForm } from "@/components/compare-form";
import { getExpressionChoiceList } from "@/lib/repository";

export default async function ComparePage() {
  const options = await getExpressionChoiceList();

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Compare</p>
        <h1>Put two whiskies side by side before you open or buy.</h1>
        <p>
          Compare distillery, bottler, release series, cask profile, pricing, and current palate fit in
          one structured view.
        </p>
      </section>
      <CompareForm options={options} />
    </div>
  );
}
