"use client";

import { type ChangeEvent, type FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { getBottleDisplayImage } from "@/lib/bottle-image";
import type { CollectionViewItem } from "@/lib/types";

type NoticeTone = "info" | "success" | "error";

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

export function BottleRecordEditor({ entry }: { entry: CollectionViewItem }) {
  const router = useRouter();
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(
    entry.images.find((image) => image.kind === "front")?.url ??
      getBottleDisplayImage(entry.expression.name, entry.images)
  );
  const [previewLabel, setPreviewLabel] = useState(
    entry.images.find((image) => image.kind === "front")?.label ?? "Current front image"
  );

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
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setPreviewUrl(dataUrl);
      setPreviewLabel(file.name);
      setNotice({
        tone: "info",
        text: `${file.name} is loaded locally. Save the bottle to persist the updated image.`
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not preview the selected image."
      });
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setNotice({ tone: "info", text: "Saving your bottle changes..." });

    const formData = new FormData(event.currentTarget);
    const payload = {
      distilleryName: String(formData.get("distilleryName") ?? "").trim(),
      bottlerName: String(formData.get("bottlerName") ?? "").trim(),
      name: String(formData.get("name") ?? "").trim(),
      releaseSeries: String(formData.get("releaseSeries") ?? "").trim() || undefined,
      bottlerKind: String(formData.get("bottlerKind") ?? "official"),
      whiskyType: String(formData.get("whiskyType") ?? "single-malt"),
      country: String(formData.get("country") ?? "").trim(),
      region: String(formData.get("region") ?? "").trim(),
      abv: parseNumber(formData.get("abv")),
      ageStatement: String(formData.get("ageStatement") ?? "").trim() || undefined,
      vintageYear: parseNumber(formData.get("vintageYear")),
      distilledYear: parseNumber(formData.get("distilledYear")),
      bottledYear: parseNumber(formData.get("bottledYear")),
      caskType: String(formData.get("caskType") ?? "").trim() || undefined,
      caskNumber: String(formData.get("caskNumber") ?? "").trim() || undefined,
      bottleNumber: String(formData.get("bottleNumber") ?? "").trim() || undefined,
      outturn: String(formData.get("outturn") ?? "").trim() || undefined,
      barcode: String(formData.get("barcode") ?? "").trim() || undefined,
      peatLevel: String(formData.get("peatLevel") ?? "medium"),
      caskInfluence: String(formData.get("caskInfluence") ?? "mixed"),
      flavorTags: parseFlavorTags(formData.get("flavorTags")),
      description: String(formData.get("description") ?? "").trim() || undefined,
      status: String(formData.get("status") ?? "owned"),
      fillState: String(formData.get("fillState") ?? "sealed"),
      purchaseCurrency: String(formData.get("purchaseCurrency") ?? "ZAR")
        .trim()
        .toUpperCase(),
      purchasePrice: parseNumber(formData.get("purchasePrice")),
      purchaseDate: String(formData.get("purchaseDate") ?? "").trim() || undefined,
      purchaseSource: String(formData.get("purchaseSource") ?? "").trim() || undefined,
      personalNotes: String(formData.get("personalNotes") ?? "").trim() || undefined,
      frontImageUrl: previewUrl || undefined,
      frontImageLabel: previewLabel || undefined
    };

    try {
      const response = await fetch(`/api/items/${entry.item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        setNotice({
          tone: "error",
          text: await readResponseMessage(response, "Could not update the bottle.")
        });
        return;
      }

      setNotice({
        tone: "success",
        text: "Bottle details updated successfully."
      });
      router.refresh();
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not update the bottle."
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete ${entry.expression.name} from your collection? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setNotice({ tone: "info", text: "Deleting the bottle from your collection..." });

    try {
      const response = await fetch(`/api/items/${entry.item.id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        setNotice({
          tone: "error",
          text: await readResponseMessage(response, "Could not delete the bottle.")
        });
        return;
      }

      router.push("/collection?notice=deleted");
      router.refresh();
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not delete the bottle."
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className={`panel stack${isSaving || isDeleting ? " panel-busy" : ""}`}>
      <div className="section-title">
        <div>
          <h2>Edit bottle record</h2>
          <p>Every visible bottle field can be changed here, including the front image.</p>
        </div>
      </div>

      {isSaving || isDeleting ? (
        <div className="panel-loader">
          {isDeleting ? "Deleting the bottle and cleaning up related data..." : "Saving your bottle changes..."}
        </div>
      ) : null}

      {notice ? <div className={`status-note status-note-${notice.tone}`}>{notice.text}</div> : null}

      <form className="form-grid" onSubmit={handleSave}>
        <div className="field full-span">
          <label htmlFor="frontImage">Front image</label>
          <input accept="image/*" id="frontImage" name="frontImage" onChange={handleFileChange} type="file" />
        </div>

        <div className="field full-span">
          <div className="image-preview-card">
            <div className="image-preview-frame">
              <Image
                alt={`${entry.expression.name} current front image`}
                className="image-preview"
                height={180}
                src={previewUrl}
                unoptimized
                width={180}
              />
            </div>
            <div className="image-preview-copy">
              <strong>{previewLabel}</strong>
              <p>Replace this image if you want a new front bottle view in the collection cabinet.</p>
            </div>
          </div>
        </div>

        <div className="field full-span form-section-title">
          <label>Identity</label>
          <p>Collector identity and bottling details.</p>
        </div>
        <div className="field">
          <label htmlFor="distilleryName">Distillery</label>
          <input defaultValue={entry.distillery.name} id="distilleryName" name="distilleryName" required />
        </div>
        <div className="field">
          <label htmlFor="bottlerName">Bottler</label>
          <input defaultValue={entry.bottler.name} id="bottlerName" name="bottlerName" required />
        </div>
        <div className="field full-span">
          <label htmlFor="name">Bottle name</label>
          <input defaultValue={entry.expression.name} id="name" name="name" required />
        </div>
        <div className="field">
          <label htmlFor="bottlerKind">Bottler kind</label>
          <select defaultValue={entry.expression.bottlerKind} id="bottlerKind" name="bottlerKind">
            <option value="official">Official bottler</option>
            <option value="independent">Independent bottler</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="releaseSeries">Release series</label>
          <input defaultValue={entry.expression.releaseSeries} id="releaseSeries" name="releaseSeries" />
        </div>
        <div className="field">
          <label htmlFor="whiskyType">Whisky type</label>
          <select defaultValue={entry.expression.whiskyType} id="whiskyType" name="whiskyType">
            <option value="single-malt">Single malt</option>
            <option value="blended-malt">Blended malt</option>
            <option value="blended-scotch">Blended Scotch</option>
            <option value="single-grain">Single grain</option>
            <option value="world-single-malt">World single malt</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="barcode">Barcode</label>
          <input defaultValue={entry.expression.barcode} id="barcode" name="barcode" />
        </div>

        <div className="field full-span form-section-title">
          <label>Specs</label>
          <p>Release specs, casks, and flavor classification.</p>
        </div>
        <div className="field">
          <label htmlFor="country">Country</label>
          <input defaultValue={entry.expression.country} id="country" name="country" required />
        </div>
        <div className="field">
          <label htmlFor="region">Region</label>
          <input defaultValue={entry.expression.region} id="region" name="region" required />
        </div>
        <div className="field">
          <label htmlFor="abv">ABV</label>
          <input defaultValue={entry.expression.abv} id="abv" min={0} name="abv" step="0.1" type="number" />
        </div>
        <div className="field">
          <label htmlFor="ageStatement">Age statement</label>
          <input defaultValue={entry.expression.ageStatement} id="ageStatement" name="ageStatement" />
        </div>
        <div className="field">
          <label htmlFor="vintageYear">Vintage year</label>
          <input defaultValue={entry.expression.vintageYear} id="vintageYear" name="vintageYear" type="number" />
        </div>
        <div className="field">
          <label htmlFor="distilledYear">Distilled year</label>
          <input defaultValue={entry.expression.distilledYear} id="distilledYear" name="distilledYear" type="number" />
        </div>
        <div className="field">
          <label htmlFor="bottledYear">Bottled year</label>
          <input defaultValue={entry.expression.bottledYear} id="bottledYear" name="bottledYear" type="number" />
        </div>
        <div className="field">
          <label htmlFor="outturn">Outturn</label>
          <input defaultValue={entry.expression.outturn} id="outturn" name="outturn" />
        </div>
        <div className="field">
          <label htmlFor="caskType">Cask type</label>
          <input defaultValue={entry.expression.caskType} id="caskType" name="caskType" />
        </div>
        <div className="field">
          <label htmlFor="caskNumber">Cask number</label>
          <input defaultValue={entry.expression.caskNumber} id="caskNumber" name="caskNumber" />
        </div>
        <div className="field">
          <label htmlFor="bottleNumber">Bottle number</label>
          <input defaultValue={entry.expression.bottleNumber} id="bottleNumber" name="bottleNumber" />
        </div>
        <div className="field">
          <label htmlFor="peatLevel">Peat level</label>
          <select defaultValue={entry.expression.peatLevel} id="peatLevel" name="peatLevel">
            <option value="unpeated">Unpeated</option>
            <option value="light">Light</option>
            <option value="medium">Medium</option>
            <option value="heavily-peated">Heavily peated</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="caskInfluence">Cask influence</label>
          <select defaultValue={entry.expression.caskInfluence} id="caskInfluence" name="caskInfluence">
            <option value="bourbon">Bourbon</option>
            <option value="sherry">Sherry</option>
            <option value="wine">Wine</option>
            <option value="rum">Rum</option>
            <option value="virgin-oak">Virgin oak</option>
            <option value="mixed">Mixed</option>
            <option value="refill">Refill</option>
          </select>
        </div>
        <div className="field full-span">
          <label htmlFor="flavorTags">Flavor tags</label>
          <input
            defaultValue={entry.expression.flavorTags.join(", ")}
            id="flavorTags"
            name="flavorTags"
          />
        </div>
        <div className="field full-span">
          <label htmlFor="description">Description</label>
          <textarea defaultValue={entry.expression.description} id="description" name="description" />
        </div>

        <div className="field full-span form-section-title">
          <label>Collection</label>
          <p>Your bottle-specific tracking fields.</p>
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select defaultValue={entry.item.status} id="status" name="status">
            <option value="owned">Owned</option>
            <option value="wishlist">Wishlist</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="fillState">Bottle state</label>
          <select defaultValue={entry.item.fillState} id="fillState" name="fillState">
            <option value="sealed">Sealed</option>
            <option value="open">Open</option>
            <option value="finished">Finished</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="purchaseCurrency">Currency</label>
          <input defaultValue={entry.item.purchaseCurrency} id="purchaseCurrency" maxLength={3} name="purchaseCurrency" />
        </div>
        <div className="field">
          <label htmlFor="purchasePrice">Purchase price</label>
          <input defaultValue={entry.item.purchasePrice} id="purchasePrice" min={0} name="purchasePrice" step="0.01" type="number" />
        </div>
        <div className="field">
          <label htmlFor="purchaseDate">Purchase date</label>
          <input defaultValue={entry.item.purchaseDate?.slice(0, 10)} id="purchaseDate" name="purchaseDate" type="date" />
        </div>
        <div className="field">
          <label htmlFor="purchaseSource">Purchase source</label>
          <input defaultValue={entry.item.purchaseSource} id="purchaseSource" name="purchaseSource" />
        </div>
        <div className="field full-span">
          <label htmlFor="personalNotes">Personal note</label>
          <textarea defaultValue={entry.item.personalNotes} id="personalNotes" name="personalNotes" />
        </div>

        <div className="field full-span editor-actions">
          <button className={`button${isSaving ? " button-active" : ""}`} disabled={isSaving || isDeleting} type="submit">
            {isSaving ? "Saving changes..." : "Save changes"}
          </button>
          <button
            className="button-danger"
            disabled={isSaving || isDeleting}
            onClick={handleDelete}
            type="button"
          >
            {isDeleting ? "Deleting..." : "Delete bottle"}
          </button>
        </div>
      </form>
    </section>
  );
}
