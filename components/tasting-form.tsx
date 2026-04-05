"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function TastingForm({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setNotice(null);

    const payload = {
      tastedAt: String(formData.get("tastedAt") ?? ""),
      nose: String(formData.get("nose") ?? ""),
      palate: String(formData.get("palate") ?? ""),
      finish: String(formData.get("finish") ?? ""),
      overallNote: String(formData.get("overallNote") ?? ""),
      rating: Number(formData.get("rating") ?? 0)
    };

    startTransition(async () => {
      const response = await fetch(`/api/items/${itemId}/tastings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        setNotice({ tone: "error", text: "Could not save the tasting note." });
        return;
      }

      setNotice({ tone: "success", text: "Tasting note saved." });
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="form-grid">
      <div className="field">
        <label htmlFor="tastedAt">Tasted on</label>
        <input defaultValue={new Date().toISOString().slice(0, 10)} id="tastedAt" name="tastedAt" type="date" />
      </div>
      <div className="field">
        <label htmlFor="rating">Rating</label>
        <select defaultValue="4" id="rating" name="rating">
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="5">5</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="nose">Nose</label>
        <textarea id="nose" name="nose" required />
      </div>
      <div className="field">
        <label htmlFor="palate">Palate</label>
        <textarea id="palate" name="palate" required />
      </div>
      <div className="field">
        <label htmlFor="finish">Finish</label>
        <textarea id="finish" name="finish" required />
      </div>
      <div className="field">
        <label htmlFor="overallNote">Overall note</label>
        <textarea id="overallNote" name="overallNote" required />
      </div>
      <div className="field full-span">
        <button className="button" disabled={isPending} type="submit">
          {isPending ? "Saving tasting..." : "Save tasting"}
        </button>
      </div>
      {notice ? (
        <div className={`status-note status-note-${notice.tone} full-span`}>{notice.text}</div>
      ) : null}
    </form>
  );
}
