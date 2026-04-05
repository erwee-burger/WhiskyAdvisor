"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type DraftResponse = {
  draftId: string;
  matchedExpressionId?: string;
  source: string;
  barcode?: string;
  expression: {
    name: string;
    releaseSeries?: string;
    bottlerKind?: string;
    region?: string;
    abv?: number;
    flavorTags?: string[];
  };
  suggestions: Array<{
    field: string;
    label: string;
    confidence: number;
  }>;
};

export function AddBottleForm() {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftResponse | null>(null);
  const [message, setMessage] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  async function fileToBase64(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;

        if (typeof result !== "string") {
          reject(new Error("Could not read image."));
          return;
        }

        resolve(result.split(",")[1] ?? "");
      };
      reader.onerror = () => reject(reader.error ?? new Error("Could not read image."));
      reader.readAsDataURL(file);
    });
  }

  async function handleBarcodeLookup(formData: FormData) {
    setMessage("");
    const barcode = String(formData.get("barcode") ?? "").trim();

    if (!barcode) {
      setMessage("Add a barcode first.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/items/intake-barcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode })
      });

      if (!response.ok) {
        setMessage("Barcode lookup failed.");
        return;
      }

      const payload = (await response.json()) as DraftResponse;
      setDraft(payload);
      setMessage("Barcode lookup complete. Review and save when ready.");
    });
  }

  async function handlePhotoLookup(formData: FormData) {
    setMessage("");
    const file = formData.get("photo");
    const fileName = file instanceof File && file.size > 0 ? file.name : String(formData.get("fileName") ?? "").trim();

    if (!fileName) {
      setMessage("Add a front-label photo or a label description first.");
      return;
    }

    startTransition(async () => {
      const imageBase64 = file instanceof File && file.size > 0 ? await fileToBase64(file) : undefined;
      const response = await fetch("/api/items/intake-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, imageBase64 })
      });

      if (!response.ok) {
        setMessage("Photo intake failed.");
        return;
      }

      const payload = (await response.json()) as DraftResponse;
      setDraft(payload);
      setMessage("Photo intake complete. Review and save when ready.");
    });
  }

  async function handleSave(formData: FormData) {
    if (!draft) {
      setMessage("Create a draft first.");
      return;
    }

    const payload = {
      draftId: draft.draftId,
      name: String(formData.get("name") ?? ""),
      status: String(formData.get("status") ?? "owned"),
      fillState: String(formData.get("fillState") ?? "sealed"),
      purchaseCurrency: String(formData.get("purchaseCurrency") ?? "ZAR"),
      purchasePrice: formData.get("purchasePrice")
        ? Number(formData.get("purchasePrice"))
        : undefined,
      purchaseDate: String(formData.get("purchaseDate") ?? "") || undefined,
      purchaseSource: String(formData.get("purchaseSource") ?? "") || undefined,
      personalNotes: String(formData.get("personalNotes") ?? "") || undefined
    };

    startTransition(async () => {
      const response = await fetch(`/api/items/${draft.draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        setMessage("Could not save the bottle.");
        return;
      }

      const saved = (await response.json()) as { itemId: string };
      router.push(`/collection/${saved.itemId}`);
      router.refresh();
    });
  }

  return (
    <div className="grid columns-2">
      <section className="panel stack">
        <div className="section-title">
          <div>
            <h2>Start a bottle draft</h2>
            <p>Photo-first, with optional barcode lookup as a helper.</p>
          </div>
        </div>
        <form action={handlePhotoLookup} className="stack">
          <div className="field">
            <label htmlFor="photo">Front label photo</label>
            <input accept="image/*" id="photo" name="photo" type="file" />
          </div>
          <div className="field">
            <label htmlFor="fileName">Or enter a label description</label>
            <input id="fileName" name="fileName" placeholder="springbank-front.jpg or Port Charlotte 10" />
          </div>
          <button className="button" disabled={isPending} type="submit">
            Run photo intake
          </button>
        </form>
        <form action={handleBarcodeLookup} className="stack">
          <div className="field">
            <label htmlFor="barcode">Barcode</label>
            <input id="barcode" name="barcode" placeholder="5000281005408" />
          </div>
          <button className="button-subtle" disabled={isPending} type="submit">
            Lookup by barcode
          </button>
        </form>
        {message ? <div className="status-note">{message}</div> : null}
      </section>
      <section className="panel stack">
        <div className="section-title">
          <div>
            <h2>Review and save</h2>
            <p>All enriched fields stay editable before the bottle is stored.</p>
          </div>
        </div>
        {draft ? (
          <>
            <div className="status-note">
              Source: {draft.source} {draft.barcode ? `· Barcode ${draft.barcode}` : ""}
            </div>
            <div className="pill-row">
              {draft.suggestions.map((suggestion) => (
                <span className="pill" key={suggestion.field}>
                  {suggestion.label} {Math.round(suggestion.confidence * 100)}%
                </span>
              ))}
            </div>
            <form action={handleSave} className="form-grid">
              <div className="field full-span">
                <label htmlFor="name">Bottle name</label>
                <input defaultValue={draft.expression.name} id="name" name="name" required />
              </div>
              <div className="field">
                <label htmlFor="status">Status</label>
                <select defaultValue="owned" id="status" name="status">
                  <option value="owned">Owned</option>
                  <option value="wishlist">Wishlist</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="fillState">Bottle state</label>
                <select defaultValue="sealed" id="fillState" name="fillState">
                  <option value="sealed">Sealed</option>
                  <option value="open">Open</option>
                  <option value="finished">Finished</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="purchaseCurrency">Currency</label>
                <input defaultValue="ZAR" id="purchaseCurrency" maxLength={3} name="purchaseCurrency" />
              </div>
              <div className="field">
                <label htmlFor="purchasePrice">Purchase price</label>
                <input id="purchasePrice" min={0} name="purchasePrice" step="0.01" type="number" />
              </div>
              <div className="field">
                <label htmlFor="purchaseDate">Purchase date</label>
                <input id="purchaseDate" name="purchaseDate" type="date" />
              </div>
              <div className="field">
                <label htmlFor="purchaseSource">Purchase source</label>
                <input id="purchaseSource" name="purchaseSource" placeholder="WhiskyBrother" />
              </div>
              <div className="field full-span">
                <label htmlFor="personalNotes">Personal note</label>
                <textarea id="personalNotes" name="personalNotes" placeholder="Why this bottle matters to you" />
              </div>
              <div className="field full-span">
                <button className="button" disabled={isPending} type="submit">
                  Save bottle
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="empty-state">
            Create a draft first. Once a barcode or photo lookup runs, the review form will appear here.
          </div>
        )}
      </section>
    </div>
  );
}
