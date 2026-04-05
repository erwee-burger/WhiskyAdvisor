import { AddBottleForm } from "@/components/add-bottle-form";

export default function AddPage() {
  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Add Bottle</p>
        <h1>Capture the bottle first, then trust yourself before saving.</h1>
        <p>
          Start with a front-label photo, optionally add a barcode, and review every AI-suggested field
          before it becomes part of your collection.
        </p>
      </section>
      <AddBottleForm />
    </div>
  );
}
