"use client";

import { type ChangeEvent, type FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

type DraftResponse = {
  draftId: string;
  matchedExpressionId?: string;
  source: string;
  barcode?: string;
  distilleryName: string;
  bottlerName: string;
  collection: {
    status: "owned" | "wishlist";
    fillState: "sealed" | "open" | "finished";
    purchaseCurrency: string;
  };
  expression: {
    brand?: string;
    name: string;
    releaseSeries?: string;
    bottlerKind: "official" | "independent";
    whiskyType:
      | "single-malt"
      | "blended-malt"
      | "blended-scotch"
      | "single-grain"
      | "world-single-malt";
    country: string;
    region: string;
    abv: number;
    ageStatement?: number;
    vintageYear?: number;
    distilledYear?: number;
    bottledYear?: number;
    volumeMl?: number;
    caskType?: string;
    caskNumber?: string;
    bottleNumber?: number;
    outturn?: number;
    barcode?: string;
    peatLevel: "unpeated" | "light" | "medium" | "heavily-peated";
    caskInfluence: "bourbon" | "sherry" | "wine" | "rum" | "virgin-oak" | "mixed" | "refill";
    isNas: boolean;
    isChillFiltered: boolean;
    isNaturalColor: boolean;
    isLimited: boolean;
    flavorTags: string[];
    description?: string;
  };
  suggestions: Array<{
    field: string;
    label: string;
    confidence: number;
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

function parseToggle(value: FormDataEntryValue | null) {
  return value !== null;
}

async function readResponseMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as {
      error?: string | { fieldErrors?: Record<string, string[]> };
    };

    if (typeof payload.error === "string") {
      return payload.error;
    }

    if (payload.error && typeof payload.error === "object" && "fieldErrors" in payload.error) {
      const fieldErrors = Object.values(payload.error.fieldErrors ?? {}).flat().filter(Boolean);
      if (fieldErrors.length > 0) {
        return fieldErrors[0];
      }
    }
  } catch {
    return fallback;
  }

  return fallback;
}

export function AddBottleForm() {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftResponse | null>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [previewLabel, setPreviewLabel] = useState<string>("");

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

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setPreviewUrl("");
      setPreviewLabel("");
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setPreviewUrl(dataUrl);
      setPreviewLabel(file.name);
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
        text: "Barcode lookup finished. Review the detected release fields and save when ready."
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
      file instanceof File && file.size > 0
        ? file.name
        : String(formData.get("fileName") ?? "").trim();

    if (!fileName) {
      setNotice({
        tone: "error",
        text: "Add a front-label photo or a label description before running intake."
      });
      return;
    }

    setBusyAction("photo");

    try {
      const imageDataUrl =
        file instanceof File && file.size > 0
          ? await fileToDataUrl(file)
          : previewUrl || undefined;

      if (imageDataUrl) {
        setPreviewUrl(imageDataUrl);
        setPreviewLabel(fileName);
      }

      const response = await fetch("/api/items/intake-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName,
          imageBase64: imageDataUrl?.split(",")[1]
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
        text: "Photo intake finished. All detected bottle fields are now editable below."
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
    const payload = {
      draftId: draft.draftId,
      distilleryName: String(formData.get("distilleryName") ?? "").trim(),
      bottlerName: String(formData.get("bottlerName") ?? "").trim(),
      brand: String(formData.get("brand") ?? "").trim() || undefined,
      name: String(formData.get("name") ?? "").trim(),
      releaseSeries: String(formData.get("releaseSeries") ?? "").trim() || undefined,
      bottlerKind: String(formData.get("bottlerKind") ?? "official"),
      whiskyType: String(formData.get("whiskyType") ?? "single-malt"),
      country: String(formData.get("country") ?? "").trim(),
      region: String(formData.get("region") ?? "").trim(),
      abv: parseNumber(formData.get("abv")),
      ageStatement: parseNumber(formData.get("ageStatement")),
      vintageYear: parseNumber(formData.get("vintageYear")),
      distilledYear: parseNumber(formData.get("distilledYear")),
      bottledYear: parseNumber(formData.get("bottledYear")),
      volumeMl: parseNumber(formData.get("volumeMl")),
      caskType: String(formData.get("caskType") ?? "").trim() || undefined,
      caskNumber: String(formData.get("caskNumber") ?? "").trim() || undefined,
      bottleNumber: parseNumber(formData.get("bottleNumber")),
      outturn: parseNumber(formData.get("outturn")),
      barcode: String(formData.get("barcode") ?? "").trim() || undefined,
      peatLevel: String(formData.get("peatLevel") ?? "medium"),
      caskInfluence: String(formData.get("caskInfluence") ?? "mixed"),
      isNas: parseToggle(formData.get("isNas")) || parseNumber(formData.get("ageStatement")) === undefined,
      isChillFiltered: parseToggle(formData.get("isChillFiltered")),
      isNaturalColor: parseToggle(formData.get("isNaturalColor")),
      isLimited: parseToggle(formData.get("isLimited")),
      flavorTags: parseFlavorTags(formData.get("flavorTags")),
      description: String(formData.get("description") ?? "").trim() || undefined,
      status: String(formData.get("status") ?? "owned"),
      fillState: String(formData.get("fillState") ?? "sealed"),
      purchaseCurrency: String(formData.get("purchaseCurrency") ?? "ZAR")
        .trim()
        .toUpperCase(),
      purchasePrice: parseNumber(formData.get("purchasePrice")),
      purchaseDate: String(formData.get("purchaseDate") ?? "") || undefined,
      purchaseSource: String(formData.get("purchaseSource") ?? "").trim() || undefined,
      personalNotes: String(formData.get("personalNotes") ?? "").trim() || undefined,
      frontImageUrl: previewUrl || undefined,
      frontImageLabel: previewLabel || undefined
    };

    setBusyAction("save");
    setNotice({ tone: "info", text: "Saving the bottle and its front image..." });

    try {
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
      router.push(`/collection/${saved.itemId}`);
      router.refresh();
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
            <div className="pill-row">
              {draft.suggestions.map((suggestion) => (
                <span className="pill" key={suggestion.field}>
                  {suggestion.label} {Math.round(suggestion.confidence * 100)}%
                </span>
              ))}
            </div>

            <form className="form-grid" key={draft.draftId} onSubmit={handleSave}>
              <div className="field full-span form-section-title">
                <label>Identity</label>
                <p>Core release fields that define the bottle and its bottling context.</p>
              </div>
              <div className="field">
                <label htmlFor="distilleryName">Distillery</label>
                <input defaultValue={draft.distilleryName} id="distilleryName" name="distilleryName" required />
              </div>
              <div className="field">
                <label htmlFor="bottlerName">Bottler</label>
                <input defaultValue={draft.bottlerName} id="bottlerName" name="bottlerName" required />
              </div>
              <div className="field">
                <label htmlFor="brand">Brand</label>
                <input
                  defaultValue={draft.expression.brand}
                  id="brand"
                  name="brand"
                  placeholder="Label brand or series name"
                />
              </div>
              <div className="field full-span">
                <label htmlFor="name">Bottle name</label>
                <input defaultValue={draft.expression.name} id="name" name="name" required />
              </div>
              <div className="field">
                <label htmlFor="bottlerKind">Bottler kind</label>
                <select defaultValue={draft.expression.bottlerKind} id="bottlerKind" name="bottlerKind">
                  <option value="official">Official bottler</option>
                  <option value="independent">Independent bottler</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="releaseSeries">Release series</label>
                <input
                  defaultValue={draft.expression.releaseSeries}
                  id="releaseSeries"
                  name="releaseSeries"
                  placeholder="Solist, Cask Strength Collection, Special Release"
                />
              </div>
              <div className="field">
                <label htmlFor="whiskyType">Whisky type</label>
                <select defaultValue={draft.expression.whiskyType} id="whiskyType" name="whiskyType">
                  <option value="single-malt">Single malt</option>
                  <option value="blended-malt">Blended malt</option>
                  <option value="blended-scotch">Blended Scotch</option>
                  <option value="single-grain">Single grain</option>
                  <option value="world-single-malt">World single malt</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="barcode">Barcode</label>
                <input defaultValue={draft.expression.barcode ?? draft.barcode} id="barcode" name="barcode" />
              </div>

              <div className="field full-span form-section-title">
                <label>Specs</label>
                <p>Collector fields for region, maturation, vintage, and batch details.</p>
              </div>
              <div className="field">
                <label htmlFor="country">Country</label>
                <input defaultValue={draft.expression.country} id="country" name="country" required />
              </div>
              <div className="field">
                <label htmlFor="region">Region</label>
                <input defaultValue={draft.expression.region} id="region" name="region" required />
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
              <div className="field">
                <label htmlFor="volumeMl">Bottle size (ml)</label>
                <input
                  defaultValue={draft.expression.volumeMl}
                  id="volumeMl"
                  min={0}
                  name="volumeMl"
                  placeholder="700"
                  type="number"
                />
              </div>
              <div className="field">
                <label htmlFor="vintageYear">Vintage year</label>
                <input defaultValue={draft.expression.vintageYear} id="vintageYear" name="vintageYear" type="number" />
              </div>
              <div className="field">
                <label htmlFor="distilledYear">Distilled year</label>
                <input defaultValue={draft.expression.distilledYear} id="distilledYear" name="distilledYear" type="number" />
              </div>
              <div className="field">
                <label htmlFor="bottledYear">Bottled year</label>
                <input defaultValue={draft.expression.bottledYear} id="bottledYear" name="bottledYear" type="number" />
              </div>
              <div className="field">
                <label htmlFor="outturn">Outturn</label>
                <input defaultValue={draft.expression.outturn} id="outturn" min={0} name="outturn" placeholder="642" type="number" />
              </div>
              <div className="field">
                <label htmlFor="caskType">Cask type</label>
                <input defaultValue={draft.expression.caskType} id="caskType" name="caskType" />
              </div>
              <div className="field">
                <label htmlFor="caskNumber">Cask number</label>
                <input defaultValue={draft.expression.caskNumber} id="caskNumber" name="caskNumber" />
              </div>
              <div className="field">
                <label htmlFor="bottleNumber">Bottle number</label>
                <input defaultValue={draft.expression.bottleNumber} id="bottleNumber" min={0} name="bottleNumber" type="number" />
              </div>
              <div className="field">
                <label htmlFor="peatLevel">Peat level</label>
                <select defaultValue={draft.expression.peatLevel} id="peatLevel" name="peatLevel">
                  <option value="unpeated">Unpeated</option>
                  <option value="light">Light</option>
                  <option value="medium">Medium</option>
                  <option value="heavily-peated">Heavily peated</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="caskInfluence">Cask influence</label>
                <select defaultValue={draft.expression.caskInfluence} id="caskInfluence" name="caskInfluence">
                  <option value="bourbon">Bourbon</option>
                  <option value="sherry">Sherry</option>
                  <option value="wine">Wine</option>
                  <option value="rum">Rum</option>
                  <option value="virgin-oak">Virgin oak</option>
                  <option value="mixed">Mixed</option>
                  <option value="refill">Refill</option>
                </select>
              </div>
              <div className="field">
                <label className="checkbox-label" htmlFor="isNas">
                  <input defaultChecked={draft.expression.isNas} id="isNas" name="isNas" type="checkbox" />
                  NAS
                </label>
              </div>
              <div className="field">
                <label className="checkbox-label" htmlFor="isChillFiltered">
                  <input
                    defaultChecked={draft.expression.isChillFiltered}
                    id="isChillFiltered"
                    name="isChillFiltered"
                    type="checkbox"
                  />
                  Chill filtered
                </label>
              </div>
              <div className="field">
                <label className="checkbox-label" htmlFor="isNaturalColor">
                  <input
                    defaultChecked={draft.expression.isNaturalColor}
                    id="isNaturalColor"
                    name="isNaturalColor"
                    type="checkbox"
                  />
                  Natural color
                </label>
              </div>
              <div className="field">
                <label className="checkbox-label" htmlFor="isLimited">
                  <input defaultChecked={draft.expression.isLimited} id="isLimited" name="isLimited" type="checkbox" />
                  Limited release
                </label>
              </div>
              <div className="field full-span">
                <label htmlFor="flavorTags">Flavor tags</label>
                <input
                  defaultValue={draft.expression.flavorTags.join(", ")}
                  id="flavorTags"
                  name="flavorTags"
                  placeholder="smoke, citrus, malt, dried-fruit"
                />
              </div>
              <div className="field full-span">
                <label htmlFor="description">Bottle description</label>
                <textarea
                  defaultValue={draft.expression.description}
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
                <textarea
                  id="personalNotes"
                  name="personalNotes"
                  placeholder="Why this bottle matters to you"
                />
              </div>
              <div className="field full-span">
                <button className={`button${busyAction === "save" ? " button-active" : ""}`} disabled={isBusy} type="submit">
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
