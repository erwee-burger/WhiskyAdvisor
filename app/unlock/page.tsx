import { UnlockForm } from "@/components/unlock-form";

export default async function UnlockPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const resolved = await searchParams;
  const nextPath =
    resolved.next && resolved.next.startsWith("/") && !resolved.next.startsWith("//")
      ? resolved.next
      : "/";

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Private Access</p>
        <h1>Unlock your whisky advisor</h1>
        <p>Enter your access token to open the private cellar workspace.</p>
      </section>
      <section className="panel" style={{ maxWidth: "520px" }}>
        <UnlockForm nextPath={nextPath} />
      </section>
    </div>
  );
}
