"use client";

import { type ChangeEvent, type FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { getBottleDisplayImage } from "@/lib/bottle-image";
import type { CollectionViewItem } from "@/lib/types";

type NoticeTone = "info" | "success" | "error";

function parseNumber(value: FormDataEntryValue | null) {
  if (value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseTags(value: FormDataEntryValue | null) {
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
    entry.expression.imageUrl ?? entry.images.find((image) => image.kind === "front")?.url ?? getBottleDisplayImage(entry.expression.name, entry.images)
  );
  const [previewLabel, setPreviewLabel] = useState(
    entry.images.find((image) => image.kind === "front")?.label ?? "Current front image"
  );

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
      brand: String(formData.get("brand") ?? "").trim() || undefined,
      name: String(formData.get("name") ?? "").trim(),
      country: String(formData.get("country") ?? "").trim(),
      abv: parseNumber(formData.get("abv")),
      ageStatement: parseNumber(formData.get("ageStatement")),
      barcode: String(formData.get("barcode") ?? "").trim() || undefined,
      description: String(formData.get("description") ?? "").trim() || undefined,
      imageUrl: previewUrl || undefined,
      tags: parseTags(formData.get("tags")),
      status: String(formData.get("status") ?? "owned"),
      fillState: String(formData.get("fillState") ?? "sealed"),
      purchaseCurrency: String(formData.get("purchaseCurrency") ?? "ZAR")
        .trim()
        .toUpperCase(),
      purchasePrice: parseNumber(formData.get("purchasePrice")),
      purchaseDate: String(formData.get("purchaseDate") ?? "").trim() || undefined,
      purchaseSource: String(formData.get("purchaseSource") ?? "").trim() || undefined,
      personalNotes: String(formData.get("personalNotes") ?? "").trim() || undefined
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
          <p>Update the bottle details, collection fields, and front image.</p>
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
          <p>Core bottle details that should always read clearly.</p>
        </div>
        <div className="field">
          <label htmlFor="distilleryName">Distillery</label>
          <input defaultValue={entry.expression.distilleryName ?? ""} id="distilleryName" name="distilleryName" />
        </div>
        <div className="field">
          <label htmlFor="bottlerName">Bottler</label>
          <input defaultValue={entry.expression.bottlerName ?? ""} id="bottlerName" name="bottlerName" />
        </div>
        <div className="field">
          <label htmlFor="brand">Brand</label>
          <input defaultValue={entry.expression.brand ?? ""} id="brand" name="brand" placeholder="Label brand or series name" />
        </div>
        <div className="field full-span">
          <label htmlFor="name">Bottle name</label>
          <input defaultValue={entry.expression.name} id="name" name="name" required />
        </div>
        <div className="field">
          <label htmlFor="country">Country</label>
          <input defaultValue={entry.expression.country ?? ""} id="country" name="country" />
        </div>
        <div className="field">
          <label htmlFor="abv">ABV</label>
          <input defaultValue={entry.expression.abv ?? ""} id="abv" min={0} name="abv" step="0.1" type="number" />
        </div>
        <div className="field">
          <label htmlFor="ageStatement">Age statement</label>
          <input defaultValue={entry.expression.ageStatement ?? ""} id="ageStatement" min={0} name="ageStatement" type="number" />
        </div>
        <div className="field">
          <label htmlFor="barcode">Barcode</label>
          <input defaultValue={entry.expression.barcode ?? ""} id="barcode" name="barcode" />
        </div>
        <div className="field full-span">
          <label htmlFor="tags">Tags</label>
          <input
            defaultValue={entry.expression.tags.join(", ")}
            id="tags"
            name="tags"
            placeholder="smoke, sherry-cask, coastal"
          />
        </div>
        <div className="field full-span">
          <label htmlFor="description">Description</label>
          <textarea defaultValue={entry.expression.description ?? ""} id="description" name="description" />
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
          <input
            defaultValue={entry.item.purchaseCurrency ?? "ZAR"}
            id="purchaseCurrency"
            maxLength={3}
            name="purchaseCurrency"
          />
        </div>
        <div className="field">
          <label htmlFor="purchasePrice">Purchase price</label>
          <input
            defaultValue={entry.item.purchasePrice ?? ""}
            id="purchasePrice"
            min={0}
            name="purchasePrice"
            step="0.01"
            type="number"
          />
        </div>
        <div className="field">
          <label htmlFor="purchaseDate">Purchase date</label>
          <input defaultValue={entry.item.purchaseDate?.slice(0, 10) ?? ""} id="purchaseDate" name="purchaseDate" type="date" />
        </div>
        <div className="field">
          <label htmlFor="purchaseSource">Purchase source</label>
          <input defaultValue={entry.item.purchaseSource ?? ""} id="purchaseSource" name="purchaseSource" />
        </div>
        <div className="field full-span">
          <label htmlFor="personalNotes">Personal note</label>
          <textarea defaultValue={entry.item.personalNotes ?? ""} id="personalNotes" name="personalNotes" />
        </div>

        <div className="field full-span editor-actions">
          <button className={`button${isSaving ? " button-active" : ""}`} disabled={isSaving || isDeleting} type="submit">
            {renderButtonLabel("Save changes", isSaving)}
          </button>
          <button
            className="button-danger"
            disabled={isSaving || isDeleting}
            onClick={handleDelete}
            type="button"
          >
            {renderButtonLabel("Delete bottle", isDeleting)}
          </button>
        </div>
      </form>
    </section>
  );
}
