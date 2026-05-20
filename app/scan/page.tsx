import { WhiskyScanner } from "@/components/whisky-scanner";

export default function ScanPage() {
  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Quick Scan</p>
        <h1>Point, shoot, know your whisky.</h1>
        <p>Snap a label and get price, tasting notes, and a verdict in seconds.</p>
      </section>
      <WhiskyScanner />
    </div>
  );
}
