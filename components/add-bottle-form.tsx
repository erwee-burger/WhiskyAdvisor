"use client";

import { type ChangeEvent, type FormEvent, useState } from "react";
import Image from "next/image";

import { readResponseMessage } from "@/lib/utils";
import { uploadImageToSupabase } from "@/lib/upload-image";

type DraftResponse = {
  draftId: string;
  matchedExpressionId?: string;
  source: string;
  barcode?: string;
  identification?: {
    identifiedName: string | null;
    brand: string | null;
    distilleryName: string | null;
    bottlerName: string | null;
    country: string | null;
    ageStatement: number | null;
    productMatchConfidence: number | null;
    internetLookupUsed: boolean | null;
    matchNotes: string | null;
  };
  rawExpression?: {
    brand?: string;
    name: string;
    distilleryName?: string;
    bottlerName?: string;
    country?: string;
    abv?: number;
    ageStatement?: number;
    barcode?: string;
    tags?: string[];
    description?: string;
  };
  distilleryName?: string;
  bottlerName?: string;
  collection: {
    status: "owned" | "wishlist";
    fillState: "sealed" | "open" | "finished";
    purchaseCurrency: string;
  };
  expression: {
    brand?: string;
    name: string;
    distilleryName?: string;
    bottlerName?: string;
    country?: string;
    abv?: number;
    ageStatement?: number;
    barcode?: string;
    tags?: string[];
    description?: string;
  };
  suggestions: Array<{
    field: string;
    label: string;
    confidence: number;
  }>;
  reviewItems: Array<{
    field: string;
    label: string;
    rawValue: string | number | string[] | boolean | undefined;
    suggestedValue: string | number | string[] | boolean | undefined;
    confidence: number;
    needsReview: boolean;
    note?: string;
  }>;
};

type NoticeTone = "info" | "success" | "error";
type BusyAction = "photo" | "barcode" | "save" | null;

function parseNumber(value: FormDataEntryValue | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseFlavorTags(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}


export function AddBottleForm() {
  const [draft, setDraft] = useState<DraftResponse | null>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [previewLabel, setPreviewLabel] = useState<string>("");
  const [previewMimeType, setPreviewMimeType] = useState<string>("image/jpeg");

  async function fileToDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;

        if (typeof result !== "string") {
          reject(new Error("Could not read the selected image."));
          return;
        }

        resolve(result);
      };
      reader.onerror = () => reject(reader.error ?? new Error("Could not read the selected image."));
      reader.readAsDataURL(file);
    });
  }

  async function resizeDataUrl(dataUrl: string, maxPx = 1200, quality = 0.82): Promise<string> {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(dataUrl); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const isPng = dataUrl.startsWith("data:image/png");
        resolve(isPng ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setPreviewUrl("");
      setPreviewLabel("");
      setPreviewMimeType("image/jpeg");
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setPreviewUrl(dataUrl);
      setPreviewLabel(file.name);
      setPreviewMimeType(file.type || "image/jpeg");
      setNotice({
        tone: "info",
        text: `${file.name} is loaded locally. Run photo intake when you want me to extract bottle data.`
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not preview the selected image."
      });
    }
  }

  async function handleBarcodeLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    const formData = new FormData(event.currentTarget);
    const barcode = String(formData.get("barcode") ?? "").trim();

    if (!barcode) {
      setNotice({ tone: "error", text: "Add a barcode before running lookup." });
      return;
    }

    setBusyAction("barcode");

    try {
      const response = await fetch("/api/items/intake-barcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode })
      });

      if (!response.ok) {
        setNotice({
          tone: "error",
          text: await readResponseMessage(response, "Barcode lookup failed.")
        });
        return;
      }

      const payload = (await response.json()) as DraftResponse;
      setDraft(payload);
      setNotice({
        tone: "success",
        text: "Barcode lookup finished. Review the detected bottle and save when ready."
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Barcode lookup failed."
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePhotoLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    const formData = new FormData(event.currentTarget);
    const file = formData.get("photo");
    const fileName =
      file instanceof File && file.size > 0 ? file.name : String(formData.get("fileName") ?? "").trim();

    if (!fileName) {
      setNotice({
        tone: "error",
        text: "Add a front-label photo or a label description before running intake."
      });
      return;
    }

    setBusyAction("photo");

    try {
      const imageMimeType =
        file instanceof File && file.size > 0 ? file.type || "image/jpeg" : previewMimeType;
      const imageDataUrl =
        file instanceof File && file.size > 0 ? await fileToDataUrl(file) : previewUrl || undefined;

      if (imageDataUrl) {
        setPreviewUrl(imageDataUrl);
        setPreviewLabel(fileName);
        if (file instanceof File && file.size > 0) {
          setPreviewMimeType(imageMimeType);
        }
      }

      const response = await fetch("/api/items/intake-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName,
          imageBase64: imageDataUrl?.split(",")[1],
          imageMimeType
        })
      });

      if (!response.ok) {
        setNotice({
          tone: "error",
          text: await readResponseMessage(response, "Photo intake failed.")
        });
        return;
      }

      const payload = (await response.json()) as DraftResponse;
      setDraft(payload);
      setNotice({
        tone: "success",
        text: "Photo intake finished. The detected bottle fields are now editable below."
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Photo intake failed."
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft) {
      setNotice({ tone: "error", text: "Create a bottle draft before saving." });
      return;
    }

    const formData = new FormData(event.currentTarget);
    let frontImageUrl = previewUrl || undefined;

    setBusyAction("save");
    setNotice({ tone: "info", text: "Saving the bottle and its front image..." });

    try {
      // Upload image to Supabase if it's a data URL
      if (frontImageUrl?.startsWith("data:")) {
        const resized = await resizeDataUrl(frontImageUrl);
        try {
          frontImageUrl = await uploadImageToSupabase(resized, draft.collectionItemId);
        } catch (uploadError) {
          setNotice({
            tone: "error",
            text: uploadError instanceof Error ? uploadError.message : "Could not upload the image."
          });
          setBusyAction(null);
          return;
        }
      }

      const payload = {
        draftId: draft.draftId,
        distilleryName: String(formData.get("distilleryName") ?? "").trim(),
        bottlerName: String(formData.get("bottlerName") ?? "").trim(),
        brand: String(formData.get("brand") ?? "").trim() || undefined,
        name: String(formData.get("name") ?? "").trim(),
        country: String(formData.get("country") ?? "").trim(),
        abv: parseNumber(formData.get("abv")),
        ageStatement: parseNumber(formData.get("ageStatement")),
        barcode: String(formData.get("barcode") ?? "").trim() || undefined,
        tags: parseFlavorTags(formData.get("tags")),
        description: String(formData.get("description") ?? "").trim() || undefined,
        status: String(formData.get("status") ?? "owned"),
        fillState: String(formData.get("fillState") ?? "sealed"),
        purchaseCurrency: String(formData.get("purchaseCurrency") ?? "ZAR").trim().toUpperCase(),
        purchasePrice: parseNumber(formData.get("purchasePrice")),
        purchaseDate: String(formData.get("purchaseDate") ?? "") || undefined,
        purchaseSource: String(formData.get("purchaseSource") ?? "").trim() || undefined,
        personalNotes: String(formData.get("personalNotes") ?? "").trim() || undefined,
        frontImageUrl,
        frontImageLabel: previewLabel || undefined
      };

      const response = await fetch(`/api/items/${draft.draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        setNotice({
          tone: "error",
          text: await readResponseMessage(response, "Could not save the bottle.")
        });
        return;
      }

      const saved = (await response.json()) as { itemId: string };
      setNotice({ tone: "success", text: "Bottle saved. Opening the record now..." });
      window.location.assign(`/collection/${saved.itemId}`);
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not save the bottle."
      });
    } finally {
      setBusyAction(null);
    }
  }

  const isBusy = busyAction !== null;

  function renderButtonLabel(text: string, spinning: boolean) {
    if (!spinning) {
      return text;
    }

    return (
      <span className="button-content">
        <span className="button-spinner" aria-hidden="true" />
        {text}
      </span>
    );
  }

  return (
    <div className="grid columns-2">
      <section className={`panel stack${busyAction === "photo" || busyAction === "barcode" ? " panel-busy" : ""}`}>
        <div className="section-title">
          <div>
            <h2>Start a bottle draft</h2>
            <p>Photo-first, with optional barcode lookup as a helper.</p>
          </div>
        </div>

        {busyAction === "photo" || busyAction === "barcode" ? (
          <div className="panel-loader">
            {busyAction === "photo"
              ? "Reading the label and building a draft..."
              : "Looking up the barcode and matching a bottle..."}
          </div>
        ) : null}

        <form className="stack" onSubmit={handlePhotoLookup}>
          <div className="field">
            <label htmlFor="photo">Front label photo</label>
            <input accept="image/*" id="photo" name="photo" onChange={handleFileChange} type="file" />
          </div>

          {previewUrl ? (
            <div className="image-preview-card">
              <div className="image-preview-frame">
                <Image
                  alt="Selected whisky bottle preview"
                  className="image-preview"
                  src={previewUrl}
                  unoptimized
                  width={180}
                  height={180}
                />
              </div>
              <div className="image-preview-copy">
                <strong>{previewLabel || "Front label loaded"}</strong>
                <p>This image will be saved with the bottle and used in your collection view.</p>
              </div>
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="fileName">Or enter a label description</label>
            <input
              id="fileName"
              name="fileName"
              placeholder="springbank-front.jpg or Port Charlotte 10"
            />
          </div>
          <button className={`button${busyAction === "photo" ? " button-active" : ""}`} disabled={isBusy} type="submit">
            {renderButtonLabel("Run photo intake", busyAction === "photo")}
          </button>
        </form>

        <form className="stack" onSubmit={handleBarcodeLookup}>
          <div className="field">
            <label htmlFor="barcode-search">Barcode</label>
            <input id="barcode-search" name="barcode" placeholder="5000281005408" />
          </div>
          <button
            className={`button-subtle${busyAction === "barcode" ? " button-active" : ""}`}
            disabled={isBusy}
            type="submit"
          >
            {renderButtonLabel("Lookup by barcode", busyAction === "barcode")}
          </button>
        </form>

        {notice ? <div className={`status-note status-note-${notice.tone}`}>{notice.text}</div> : null}
      </section>

      <section className={`panel stack${busyAction === "save" ? " panel-busy" : ""}`}>
        <div className="section-title">
          <div>
            <h2>Review and save</h2>
            <p>Every field that gets stored is visible and editable before save.</p>
          </div>
        </div>

        {busyAction === "save" ? <div className="panel-loader">Saving the bottle to your collection...</div> : null}

        {draft ? (
          <>
            <div className="status-note status-note-info">
              Source: {draft.source}
              {draft.barcode ? ` | Barcode ${draft.barcode}` : ""}
            </div>

            {draft.identification ? (
              <div className="review-panel">
                <div className="section-title">
                  <div>
                    <h3>Step 1: Identification</h3>
                    <p>What the first pass believes this bottle is.</p>
                  </div>
                </div>
                <div className="review-list">
                  <article className="review-item">
                    <div className="review-item-head">
                      <strong>{draft.identification.identifiedName ?? "Unidentified"}</strong>
                      <span className="pill">
                        {draft.identification.productMatchConfidence === null
                          ? "No confidence"
                          : `${Math.round(draft.identification.productMatchConfidence * 100)}%`}
                      </span>
                    </div>
                    <p className="muted">
                      {draft.identification.brand ?? "Brand not confirmed"}
                      {draft.identification.distilleryName ? ` - ${draft.identification.distilleryName}` : ""}
                      {draft.identification.bottlerName ? ` - ${draft.identification.bottlerName}` : ""}
                    </p>
                    {draft.identification.matchNotes ? <p>{draft.identification.matchNotes}</p> : null}
                  </article>
                </div>
              </div>
            ) : null}

            <div className="pill-row">
              {(draft.suggestions ?? []).map((suggestion) => (
                <span className="pill" key={suggestion.field}>
                  {suggestion.label} {Math.round(suggestion.confidence * 100)}%
                </span>
              ))}
            </div>

            <div className="review-panel">
              <div className="section-title">
                <div>
                  <h3>Review differences</h3>
                  <p>Raw AI values are shown next to the mapped values before you save.</p>
                </div>
              </div>
              {(draft.reviewItems ?? []).filter((item) => item.needsReview).length > 0 ? (
                <div className="review-list">
                  {(draft.reviewItems ?? [])
                    .filter((item) => item.needsReview)
                    .map((item) => (
                      <article className="review-item" key={item.field}>
                        <div className="review-item-head">
                          <strong>{item.label}</strong>
                          <span className="pill">{Math.round(item.confidence * 100)}%</span>
                        </div>
                        <p>
                          Raw: <span className="review-value">{String(item.rawValue ?? "Not set")}</span>
                        </p>
                        <p>
                          Suggested: <span className="review-value">{String(item.suggestedValue ?? "Not set")}</span>
                        </p>
                        {item.note ? <p className="muted">{item.note}</p> : null}
                      </article>
                    ))}
                </div>
              ) : (
                <div className="status-note status-note-success">
                  No mapping differences detected. The AI values can be reviewed directly in the form below.
                </div>
              )}
            </div>

            <form className="form-grid" key={draft.draftId} onSubmit={handleSave}>
              <div className="field full-span form-section-title">
                <label>Identity</label>
                <p>Flat bottle identity fields that remain editable before save.</p>
              </div>
              <div className="field">
                <label htmlFor="distilleryName">Distillery</label>
                <input defaultValue={draft.distilleryName ?? ""} id="distilleryName" name="distilleryName" />
              </div>
              <div className="field">
                <label htmlFor="bottlerName">Bottler</label>
                <input defaultValue={draft.bottlerName ?? ""} id="bottlerName" name="bottlerName" />
              </div>
              <div className="field">
                <label htmlFor="brand">Brand</label>
                <input
                  defaultValue={draft.expression.brand ?? ""}
                  id="brand"
                  name="brand"
                  placeholder="Label brand or house name"
                />
              </div>
              <div className="field full-span">
                <label htmlFor="name">Bottle name</label>
                <input defaultValue={draft.expression.name} id="name" name="name" required />
              </div>
              <div className="field">
                <label htmlFor="barcode">Barcode</label>
                <input defaultValue={draft.expression.barcode ?? draft.barcode ?? ""} id="barcode" name="barcode" />
              </div>

              <div className="field full-span form-section-title">
                <label>Specs</label>
                <p>Collector fields for country, strength, tags, and short description.</p>
              </div>
              <div className="field">
                <label htmlFor="country">Country</label>
                <input defaultValue={draft.expression.country ?? ""} id="country" name="country" required />
              </div>
              <div className="field">
                <label htmlFor="abv">ABV</label>
                <input defaultValue={draft.expression.abv} id="abv" min={0} name="abv" step="0.1" type="number" />
              </div>
              <div className="field">
                <label htmlFor="ageStatement">Age statement</label>
                <input
                  defaultValue={draft.expression.ageStatement}
                  id="ageStatement"
                  min={0}
                  name="ageStatement"
                  placeholder="10, 12"
                  type="number"
                />
              </div>
              <div className="field full-span">
                <label htmlFor="tags">Tags</label>
                <input
                  defaultValue={(draft.expression.tags ?? []).join(", ")}
                  id="tags"
                  name="tags"
                  placeholder="single-malt, sherry-cask, peated, limited, spicy, dried-fruit"
                />
                <p className="muted">Comma-separated. AI fills these automatically, and you can adjust them before save.</p>
              </div>
              <div className="field full-span">
                <label htmlFor="description">Bottle description</label>
                <textarea
                  defaultValue={draft.expression.description ?? ""}
                  id="description"
                  name="description"
                  placeholder="Short summary of the release or what stands out."
                />
              </div>

              <div className="field full-span form-section-title">
                <label>Collection</label>
                <p>These fields are personal to your bottle and stay editable after save in a later slice.</p>
              </div>
              <div className="field">
                <label htmlFor="status">Status</label>
                <select defaultValue={draft.collection.status} id="status" name="status">
                  <option value="owned">Owned</option>
                  <option value="wishlist">Wishlist</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="fillState">Bottle state</label>
                <select defaultValue={draft.collection.fillState} id="fillState" name="fillState">
                  <option value="sealed">Sealed</option>
                  <option value="open">Open</option>
                  <option value="finished">Finished</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="purchaseCurrency">Currency</label>
                <input
                  defaultValue={draft.collection.purchaseCurrency}
                  id="purchaseCurrency"
                  maxLength={3}
                  name="purchaseCurrency"
                />
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
                <button
                  className={`button${busyAction === "save" ? " button-active" : ""}`}
                  disabled={isBusy}
                  type="submit"
                >
                  {renderButtonLabel("Save bottle", busyAction === "save")}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="empty-state">
            Create a draft first. Once photo or barcode intake runs, the full editable bottle form will appear here.
          </div>
        )}
      </section>
    </div>
  );
}
