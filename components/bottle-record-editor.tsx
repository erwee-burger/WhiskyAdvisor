"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { getBottleDisplayImage } from "@/lib/bottle-image";
import {
  areSuggestionValuesEqual,
  buildBottleDetailFormState,
  bottleDetailFieldDefinitions,
  type BottleDetailFieldDefinition,
  type BottleDetailFieldId,
  type BottleDetailFormState,
  formatFieldValue,
  formatSuggestionValueForDisplay,
  getBottleDetailFieldDefinition,
  getFieldRawValue,
  isAiBottleDetailField,
  parseTagsText,
  serializeSuggestionValue,
  type AiBottleDetailFieldId,
  type BottleFieldSuggestionResponse
} from "@/lib/bottle-detail";
import type { CollectionViewItem } from "@/lib/types";
import {
  getCaskStyleTags,
  getPeatTag,
  isChillFiltered,
  isIndependentBottler,
  isLimited,
  isNas,
  isNaturalColour
} from "@/lib/tags";
import { readResponseMessage } from "@/lib/utils";
import { uploadImageToSupabase } from "@/lib/upload-image";

type NoticeTone = "info" | "success" | "error";
type FocusableControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type SuggestionState =
  | {
      field: AiBottleDetailFieldId;
      status: "loading";
    }
  | {
      field: AiBottleDetailFieldId;
      status: "error";
      message: string;
    }
  | {
      field: AiBottleDetailFieldId;
      status: "ready" | "empty";
      response: BottleFieldSuggestionResponse;
      editableValue: string;
    };

function PencilIcon() {
  return (
    <svg aria-hidden="true" className="detail-icon" viewBox="0 0 24 24">
      <path
        d="M4 16.25V20h3.75l11-11-3.75-3.75-11 11Zm14.71-9.04a1 1 0 0 0 0-1.42l-1.5-1.5a1 1 0 0 0-1.42 0l-1.17 1.17 3.75 3.75 1.34-1.17Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg aria-hidden="true" className="detail-icon" viewBox="0 0 24 24">
      <path
        d="m12 2 1.76 5.24L19 9l-5.24 1.76L12 16l-1.76-5.24L5 9l5.24-1.76L12 2Zm7 11 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3ZM5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Z"
        fill="currentColor"
      />
    </svg>
  );
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function getInitialPreview(entry: CollectionViewItem) {
  return {
    url:
      entry.expression.imageUrl ??
      entry.images.find((image) => image.kind === "front")?.url ??
      getBottleDisplayImage(entry.expression.name, entry.images),
    label: entry.images.find((image) => image.kind === "front")?.label ?? "Current front image"
  };
}

function buildHeroSummary(values: BottleDetailFormState) {
  const name = values.name.trim() || "Unnamed bottle";
  const brand = values.brand.trim();
  const distillery = values.distilleryName.trim();
  const bottler = values.bottlerName.trim();
  const prefix =
    brand && brand !== distillery && brand !== bottler
      ? `${brand}. `
      : "";

  return {
    name,
    copy: `${prefix}${distillery || "Unknown distillery"} distilled it. ${bottler || "Unknown bottler"} released it.`
  };
}

const GUEST_HIDDEN_COLLECTION_FIELDS: BottleDetailFieldId[] = [
  "purchasePrice",
  "purchaseCurrency",
  "personalNotes"
];

export function BottleRecordEditor({ entry, isOwner = true }: { entry: CollectionViewItem; isOwner?: boolean }) {
  const router = useRouter();
  const fieldRefs = useRef<Partial<Record<BottleDetailFieldId, FocusableControl | null>>>({});
  const initialValues = useMemo(() => buildBottleDetailFormState(entry), [entry]);
  const initialPreview = useMemo(() => getInitialPreview(entry), [entry]);

  const [baseValues, setBaseValues] = useState(initialValues);
  const [formValues, setFormValues] = useState(initialValues);
  const [previewUrl, setPreviewUrl] = useState(initialPreview.url);
  const [previewLabel, setPreviewLabel] = useState(initialPreview.label);
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [focusedField, setFocusedField] = useState<BottleDetailFieldId | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState<SuggestionState | null>(null);

  useEffect(() => {
    setBaseValues(initialValues);
    setFormValues(initialValues);
    setPreviewUrl(initialPreview.url);
    setPreviewLabel(initialPreview.label);
    setNotice(null);
    setIsEditing(false);
    setFocusedField(null);
    setActiveSuggestion(null);
  }, [initialPreview, initialValues]);

  useEffect(() => {
    if (!isEditing || !focusedField) {
      return;
    }

    const control = fieldRefs.current[focusedField];
    control?.focus();
  }, [focusedField, isEditing]);

  const currentTags = parseTagsText(formValues.tags);
  const bottleImage = previewUrl || getBottleDisplayImage(formValues.name || entry.expression.name, entry.images);
  const heroSummary = buildHeroSummary(formValues);
  const caskTags = getCaskStyleTags(currentTags);
  const signalTags = [
    getPeatTag(currentTags),
    ...caskTags.slice(0, 2),
    isIndependentBottler(currentTags) ? "independent-bottler" : null,
    isNas(currentTags) ? "nas" : null,
    isChillFiltered(currentTags) ? "chill-filtered" : null,
    isNaturalColour(currentTags) ? "natural-colour" : null,
    isLimited(currentTags) ? "limited" : null
  ]
    .filter(Boolean)
    .map((tag) => String(tag));

  function registerFieldRef(field: BottleDetailFieldId) {
    return (node: FocusableControl | null) => {
      fieldRefs.current[field] = node;
    };
  }

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

  function updateField<K extends keyof BottleDetailFormState>(field: K, value: BottleDetailFormState[K]) {
    setFormValues((current) => ({
      ...current,
      [field]: value
    }));
  }

  function enterEditMode(field: BottleDetailFieldId) {
    if (!isOwner) return;
    setIsEditing(true);
    setFocusedField(field);
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

    let frontImageUrl = previewUrl || undefined;

    try {
      if (frontImageUrl?.startsWith("data:")) {
        frontImageUrl = await uploadImageToSupabase(frontImageUrl, entry.item.id);
      }

      const payload = {
        distilleryName: formValues.distilleryName.trim(),
        bottlerName: formValues.bottlerName.trim(),
        brand: formValues.brand.trim() || undefined,
        name: formValues.name.trim(),
        country: formValues.country.trim() || undefined,
        abv: parseOptionalNumber(formValues.abv),
        ageStatement: parseOptionalNumber(formValues.ageStatement),
        barcode: formValues.barcode.trim() || undefined,
        description: formValues.description.trim() || undefined,
        frontImageUrl,
        frontImageLabel: previewLabel || undefined,
        tags: parseTagsText(formValues.tags),
        status: formValues.status,
        fillState: formValues.fillState,
        purchaseCurrency: formValues.purchaseCurrency.trim().toUpperCase() || "ZAR",
        purchasePrice: parseOptionalNumber(formValues.purchasePrice),
        purchaseDate: formValues.purchaseDate.trim() || undefined,
        purchaseSource: formValues.purchaseSource.trim() || undefined,
        personalNotes: formValues.personalNotes.trim() || undefined
      };

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

      setBaseValues(formValues);
      setNotice({
        tone: "success",
        text: "Bottle details updated successfully."
      });
      setIsEditing(false);
      setFocusedField(null);
      setActiveSuggestion(null);
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

  function handleCancel() {
    setFormValues(baseValues);
    setPreviewUrl(initialPreview.url);
    setPreviewLabel(initialPreview.label);
    setIsEditing(false);
    setFocusedField(null);
    setActiveSuggestion(null);
    setNotice({ tone: "info", text: "Unsaved changes were discarded." });
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

  async function requestSuggestion(field: AiBottleDetailFieldId) {
    enterEditMode(field);
    setActiveSuggestion({ field, status: "loading" });

    try {
      const currentValue = getFieldRawValue(field, formValues);
      const response = await fetch(`/api/items/${entry.item.id}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field,
          currentValue,
          draftValues: formValues
        })
      });

      if (!response.ok) {
        setActiveSuggestion({
          field,
          status: "error",
          message: await readResponseMessage(response, "Could not generate an AI suggestion for this field.")
        });
        return;
      }

      const suggestion = (await response.json()) as BottleFieldSuggestionResponse;

      if (
        suggestion.status !== "suggestion" ||
        suggestion.suggestedValue === null ||
        areSuggestionValuesEqual(field, currentValue, suggestion.suggestedValue)
      ) {
        setActiveSuggestion({
          field,
          status: "empty",
          response: suggestion,
          editableValue: ""
        });
        return;
      }

      setActiveSuggestion({
        field,
        status: "ready",
        response: suggestion,
        editableValue: serializeSuggestionValue(field, suggestion.suggestedValue)
      });
    } catch (error) {
      setActiveSuggestion({
        field,
        status: "error",
        message: error instanceof Error ? error.message : "Could not generate an AI suggestion for this field."
      });
    }
  }

  function applySuggestion() {
    if (!activeSuggestion || activeSuggestion.status !== "ready") {
      return;
    }

    const { field, editableValue } = activeSuggestion;
    setFormValues((current) => {
      const next = {
        ...current,
        [field]: editableValue
      } as BottleDetailFormState;

      if (field === "purchasePrice") {
        next.purchaseCurrency = "ZAR";
      }

      return next;
    });

    setActiveSuggestion(null);
    setNotice(
      field === "purchasePrice"
        ? {
            tone: "info",
            text: "Applied the South African market reference estimate and set the currency to ZAR."
          }
        : {
            tone: "success",
            text: "Applied the AI suggestion to the form. Save when you are ready."
          }
    );
  }

  function renderSuggestionEditor(field: AiBottleDetailFieldId, value: string) {
    if (field === "description") {
      return (
        <textarea
          className="detail-suggestion-input"
          onChange={(event) =>
            setActiveSuggestion((current) =>
              current && current.field === field && (current.status === "ready" || current.status === "empty")
                ? { ...current, editableValue: event.target.value }
                : current
            )
          }
          value={value}
        />
      );
    }

    return (
      <input
        className="detail-suggestion-input"
        min={field === "abv" || field === "purchasePrice" || field === "ageStatement" ? 0 : undefined}
        onChange={(event) =>
          setActiveSuggestion((current) =>
            current && current.field === field && (current.status === "ready" || current.status === "empty")
              ? { ...current, editableValue: event.target.value }
              : current
          )
        }
        step={field === "abv" ? "0.1" : field === "purchasePrice" ? "0.01" : undefined}
        type={field === "abv" || field === "ageStatement" || field === "purchasePrice" ? "number" : "text"}
        value={value}
      />
    );
  }

  function renderSuggestionDiff(response: BottleFieldSuggestionResponse) {
    if (!response.diff) {
      return null;
    }

    if (response.diff.kind === "tags") {
      return (
        <div className="detail-suggestion-diff">
          <div className="detail-suggestion-block">
            <span className="detail-suggestion-label">Current tags</span>
            <div className="pill-row">
              {response.diff.current.length > 0 ? (
                response.diff.current.map((tag) => (
                  <span className="pill" key={`current-${tag}`}>
                    {tag}
                  </span>
                ))
              ) : (
                <span className="detail-field-empty">No tags set</span>
              )}
            </div>
          </div>
          <div className="detail-suggestion-block">
            <span className="detail-suggestion-label">Suggested tags</span>
            <div className="pill-row">
              {response.diff.suggested.length > 0 ? (
                response.diff.suggested.map((tag) => (
                  <span className="pill" key={`suggested-${tag}`}>
                    {tag}
                  </span>
                ))
              ) : (
                <span className="detail-field-empty">No tags suggested</span>
              )}
            </div>
          </div>
          <div className="detail-tag-diff-grid">
            <div className="detail-suggestion-list detail-suggestion-list-remove">
              <span className="detail-suggestion-label">Remove</span>
              {response.diff.removed.length > 0 ? (
                response.diff.removed.map((tag) => (
                  <span className="detail-diff-chip detail-diff-chip-remove" key={`remove-${tag}`}>
                    - {tag}
                  </span>
                ))
              ) : (
                <span className="detail-field-empty">Nothing to remove</span>
              )}
            </div>
            <div className="detail-suggestion-list detail-suggestion-list-add">
              <span className="detail-suggestion-label">Add</span>
              {response.diff.added.length > 0 ? (
                response.diff.added.map((tag) => (
                  <span className="detail-diff-chip detail-diff-chip-add" key={`add-${tag}`}>
                    + {tag}
                  </span>
                ))
              ) : (
                <span className="detail-field-empty">Nothing new to add</span>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (response.diff.kind === "text") {
      return (
        <div className="detail-suggestion-diff">
          <div className="detail-suggestion-block">
            <span className="detail-suggestion-label">Current value</span>
            <div className="detail-value-box">{response.diff.current || "Not set"}</div>
          </div>
          <div className="detail-suggestion-block">
            <span className="detail-suggestion-label">Suggested value</span>
            <div className="detail-value-box">{response.diff.suggested || "Not set"}</div>
          </div>
          <div className="detail-code-diff">
            <div className="detail-code-line detail-code-line-remove">
              <span className="detail-code-marker">-</span>
              <span>{response.diff.removedText || "No removals"}</span>
            </div>
            <div className="detail-code-line detail-code-line-add">
              <span className="detail-code-marker">+</span>
              <span>{response.diff.addedText || "No additions"}</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="detail-suggestion-diff">
        <div className="detail-suggestion-block">
          <span className="detail-suggestion-label">Current value</span>
          <div className="detail-value-box">{response.diff.current || "Not set"}</div>
        </div>
        <div className="detail-suggestion-block">
          <span className="detail-suggestion-label">Suggested value</span>
          <div className="detail-value-box">{response.diff.suggested || "Not set"}</div>
        </div>
      </div>
    );
  }

  function renderSuggestionPanel(field: AiBottleDetailFieldId) {
    if (!activeSuggestion || activeSuggestion.field !== field) {
      return null;
    }

    if (activeSuggestion.status === "loading") {
      return (
        <div className="detail-suggestion-panel">
          <div className="panel-loader">Checking the web and preparing an AI suggestion...</div>
          <div className="detail-suggestion-actions">
            <button className="button-subtle" onClick={() => setActiveSuggestion(null)} type="button">
              Dismiss
            </button>
          </div>
        </div>
      );
    }

    if (activeSuggestion.status === "error") {
      return (
        <div className="detail-suggestion-panel">
          <div className="status-note status-note-error">{activeSuggestion.message}</div>
          <div className="detail-suggestion-actions">
            <button className="button-subtle" onClick={() => requestSuggestion(field)} type="button">
              Retry
            </button>
            <button className="button-subtle" onClick={() => setActiveSuggestion(null)} type="button">
              Dismiss
            </button>
          </div>
        </div>
      );
    }

    const { response, editableValue, status } = activeSuggestion;
    const currentValue = getFieldRawValue(field, formValues);
    const purchaseCurrency = field === "purchasePrice" ? "ZAR" : formValues.purchaseCurrency.trim().toUpperCase();

    return (
      <div className="detail-suggestion-panel">
        <div className="detail-suggestion-header">
          <div>
            <strong>AI suggestion</strong>
            <p>{response.rationale}</p>
          </div>
          {response.confidence !== null ? (
            <span className="pill">{Math.round(response.confidence * 100)}%</span>
          ) : null}
        </div>

        {response.priceContext === "za-market-reference" ? (
          <div className="status-note status-note-info">
            This suggestion is a South African market reference estimate in ZAR, not your historical paid price.
          </div>
        ) : null}

        {status === "empty" ? (
          <div className="status-note status-note-info">
            No confident change was found for this field right now.
          </div>
        ) : (
          <>
            {renderSuggestionDiff(response)}
            <div className="detail-suggestion-block">
              <span className="detail-suggestion-label">Editable suggestion</span>
              {renderSuggestionEditor(field, editableValue)}
            </div>
            <div className="detail-suggestion-inline-copy">
              Current:{" "}
              <strong>
                {formatSuggestionValueForDisplay(field, currentValue, {
                  purchaseCurrency: formValues.purchaseCurrency.trim().toUpperCase() || "ZAR"
                })}
              </strong>
              {" | "}
              Suggested:{" "}
              <strong>
                {formatSuggestionValueForDisplay(field, response.suggestedValue, {
                  purchaseCurrency
                })}
              </strong>
            </div>
          </>
        )}

        {response.citations.length > 0 ? (
          <div className="detail-suggestion-sources">
            <span className="detail-suggestion-label">Sources</span>
            <div className="review-list">
              {response.citations.map((citation) => (
                <article className="review-item" key={`${citation.url}-${citation.label}`}>
                  <div className="review-item-head">
                    <strong>{citation.label}</strong>
                    <a href={citation.url} rel="noreferrer" target="_blank">
                      Open source
                    </a>
                  </div>
                  <p>{citation.snippet}</p>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        <div className="detail-suggestion-actions">
          {status === "ready" ? (
            <button className="button" onClick={applySuggestion} type="button">
              Apply to form
            </button>
          ) : null}
          <button className="button-subtle" onClick={() => requestSuggestion(field)} type="button">
            Retry
          </button>
          <button className="button-subtle" onClick={() => setActiveSuggestion(null)} type="button">
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  function renderDisplayValue(definition: BottleDetailFieldDefinition) {
    if (definition.id === "tags") {
      return currentTags.length > 0 ? (
        <div className="pill-row">
          {currentTags.map((tag) => (
            <span className="pill" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      ) : (
        <span className="detail-field-empty">No tags set</span>
      );
    }

    if (definition.id === "description" || definition.id === "personalNotes") {
      const value = formatFieldValue(definition.id, formValues);
      return value === "Not set" ? (
        <span className="detail-field-empty">Not set</span>
      ) : (
        <p className="detail-field-paragraph">{value}</p>
      );
    }

    const value = formatFieldValue(definition.id, formValues);
    return value === "Not set" ? (
      <span className="detail-field-empty">Not set</span>
    ) : (
      <span className="detail-field-value">{value}</span>
    );
  }

  function renderEditorValue(definition: BottleDetailFieldDefinition) {
    const fieldId = definition.id;

    if (fieldId === "frontImage") {
      return null;
    }

    switch (definition.input) {
      case "textarea":
        return (
          <textarea
            id={fieldId}
            onChange={(event) => updateField(fieldId, event.target.value)}
            ref={registerFieldRef(fieldId)}
            value={formValues[fieldId as keyof BottleDetailFormState] as string}
          />
        );
      case "number":
        return (
          <input
            id={fieldId}
            min={0}
            onChange={(event) => updateField(fieldId, event.target.value)}
            ref={registerFieldRef(fieldId)}
            step={fieldId === "abv" ? "0.1" : fieldId === "purchasePrice" ? "0.01" : undefined}
            type="number"
            value={formValues[fieldId as keyof BottleDetailFormState] as string}
          />
        );
      case "select":
        if (fieldId === "status") {
          return (
            <select
              id={fieldId}
              onChange={(event) => updateField(fieldId, event.target.value as BottleDetailFormState["status"])}
              ref={registerFieldRef(fieldId)}
              value={formValues.status}
            >
              <option value="owned">Owned</option>
              <option value="wishlist">Wishlist</option>
            </select>
          );
        }

        return (
          <select
            id={fieldId}
            onChange={(event) => updateField(fieldId, event.target.value as BottleDetailFormState["fillState"])}
            ref={registerFieldRef(fieldId)}
            value={formValues.fillState}
          >
            <option value="sealed">Sealed</option>
            <option value="open">Open</option>
            <option value="finished">Finished</option>
          </select>
        );
      case "date":
        return (
          <input
            id={fieldId}
            onChange={(event) => updateField(fieldId, event.target.value)}
            ref={registerFieldRef(fieldId)}
            type="date"
            value={formValues.purchaseDate}
          />
        );
      case "tags":
        return (
          <>
            <input
              id={fieldId}
              onChange={(event) => updateField(fieldId, event.target.value)}
              ref={registerFieldRef(fieldId)}
              value={formValues.tags}
            />
            <p className="muted">Comma-separated tags. AI suggestions can add or remove them before save.</p>
          </>
        );
      default:
        return (
          <input
            id={fieldId}
            maxLength={fieldId === "purchaseCurrency" ? 3 : undefined}
            onChange={(event) =>
              updateField(
                fieldId,
                fieldId === "purchaseCurrency" ? event.target.value.toUpperCase() : event.target.value
              )
            }
            ref={registerFieldRef(fieldId)}
            type="text"
            value={formValues[fieldId as keyof BottleDetailFormState] as string}
          />
        );
    }
  }

  function renderFieldRow(definition: BottleDetailFieldDefinition) {
    if (definition.id === "frontImage") {
      return null;
    }

    const aiFieldId =
      definition.aiEnabled && isAiBottleDetailField(definition.id) ? definition.id : null;

    return (
      <div
        className={`detail-field-card${definition.fullSpan ? " detail-field-card-full" : ""}`}
        key={definition.id}
      >
        <div className="detail-field-head">
          <div className="detail-field-title-block">
            <span className="detail-field-label">{definition.label}</span>
          </div>
          <div className="detail-field-tools">
            {isOwner && aiFieldId ? (
              <button
                aria-label={`Ask AI about ${definition.label}`}
                className="detail-icon-button"
                onClick={() => requestSuggestion(aiFieldId)}
                title={`Ask AI about ${definition.label}`}
                type="button"
              >
                <SparkleIcon />
              </button>
            ) : null}
            {isOwner && (
              <button
                aria-label={`Edit ${definition.label}`}
                className="detail-icon-button"
                onClick={() => enterEditMode(definition.id)}
                title={`Edit ${definition.label}`}
                type="button"
              >
                <PencilIcon />
              </button>
            )}
          </div>
        </div>

        <div className="detail-field-body">
          {isEditing ? renderEditorValue(definition) : renderDisplayValue(definition)}
        </div>

        {aiFieldId ? renderSuggestionPanel(aiFieldId) : null}
      </div>
    );
  }

  const identityFields = bottleDetailFieldDefinitions.filter((field) => field.section === "identity");
  const specFields = bottleDetailFieldDefinitions.filter((field) => field.section === "specs");
  const collectionFields = bottleDetailFieldDefinitions
    .filter((field) => field.section === "collection")
    .filter((field) => isOwner || !GUEST_HIDDEN_COLLECTION_FIELDS.includes(field.id));
  const imageField = getBottleDetailFieldDefinition("frontImage");

  return (
    <form className={`stack${isSaving || isDeleting ? " panel-busy" : ""}`} onSubmit={handleSave}>
      <section className="hero bottle-detail-hero">
        <div className="detail-image-stack">
          <div className="detail-field-head detail-field-head-image">
            <div className="detail-field-title-block">
              <span className="detail-field-label">{imageField?.label ?? "Front image"}</span>
              <span className="detail-field-subcopy">{previewLabel}</span>
            </div>
            {isOwner && (
              <div className="detail-field-tools">
                <button
                  aria-label="Edit front image"
                  className="detail-icon-button"
                  onClick={() => enterEditMode("frontImage")}
                  title="Edit front image"
                  type="button"
                >
                  <PencilIcon />
                </button>
              </div>
            )}
          </div>

          <div className="bottle-stand">
            <Image
              alt={`${heroSummary.name} bottle cutout`}
              height={320}
              src={bottleImage}
              unoptimized
              width={220}
            />
          </div>

          {isEditing ? (
            <div className="field">
              <label htmlFor="frontImage">Replace front image</label>
              <input
                accept="image/*"
                id="frontImage"
                onChange={handleFileChange}
                ref={registerFieldRef("frontImage")}
                type="file"
              />
            </div>
          ) : (
            <p className="muted">Use the pencil to replace the current front bottle view.</p>
          )}
        </div>

        <div className="detail-hero-copy">
          <p className="eyebrow">Bottle Detail</p>
          <h1>{heroSummary.name}</h1>
          <p>{heroSummary.copy} This record now keeps every editable field in the top detail surface.</p>

          <div className="pill-row">
            {formValues.country.trim() ? <span className="pill">{formValues.country.trim()}</span> : null}
            {formValues.abv.trim() ? <span className="pill">{formValues.abv.trim()}% ABV</span> : null}
            <span className="pill">{formValues.status === "wishlist" ? "Wishlist" : "Owned"}</span>
            <span className="pill">
              {formValues.fillState === "open"
                ? "Open"
                : formValues.fillState === "finished"
                  ? "Finished"
                  : "Sealed"}
            </span>
            <span className="pill">
              {isNas(currentTags)
                ? "NAS"
                : formValues.ageStatement.trim()
                  ? `${formValues.ageStatement.trim()} years`
                  : "Age not set"}
            </span>
            <span className="pill">{isIndependentBottler(currentTags) ? "Independent" : "Official"}</span>
          </div>

          {signalTags.length > 0 ? (
            <div className="pill-row" style={{ marginTop: "12px" }}>
              {signalTags.map((tag) => (
                <span className="pill" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <div className="grid columns-2" style={{ marginTop: "16px" }}>
            {isOwner && (
              <div className="status-note">
                {formatFieldValue("purchasePrice", formValues)}
              </div>
            )}
            <div className="status-note">
              {formValues.description.trim() || "No bottle description saved yet"}
            </div>
          </div>

          {isOwner && (
            <div className="hero-actions">
              {isEditing ? (
                <>
                  <button className={`button${isSaving ? " button-active" : ""}`} disabled={isSaving || isDeleting} type="submit">
                    {renderButtonLabel("Save changes", isSaving)}
                  </button>
                  <button className="button-subtle" disabled={isSaving || isDeleting} onClick={handleCancel} type="button">
                    Cancel
                  </button>
                </>
              ) : (
                <div className="status-note">Use any pencil to enter edit mode for the full record.</div>
              )}
              <button
                className="button-danger"
                disabled={isSaving || isDeleting}
                onClick={handleDelete}
                type="button"
              >
                {renderButtonLabel("Delete bottle", isDeleting)}
              </button>
            </div>
          )}

          {isOwner && (isSaving || isDeleting) && (
            <div className="panel-loader">
              {isDeleting ? "Deleting the bottle and cleaning up related data..." : "Saving your bottle changes..."}
            </div>
          )}
        </div>
      </section>

      <section className="grid columns-2">
        <div className="panel stack">
          <div className="section-title">
            <div>
              <h2>Identity</h2>
              <p>Core bottle identity and release naming fields.</p>
            </div>
          </div>
          <div className="detail-fields-grid">
            {identityFields.map(renderFieldRow)}
          </div>
        </div>

        <div className="panel stack">
          <div className="section-title">
            <div>
              <h2>Specs</h2>
              <p>Release metadata, bottle facts, and searchable tags.</p>
            </div>
          </div>
          <div className="detail-fields-grid">
            {specFields.map(renderFieldRow)}
          </div>
        </div>
      </section>

      <section className="panel stack">
        <div className="section-title">
          <div>
            <h2>Collection</h2>
            <p>Your bottle-specific tracking fields stay editable in the same top surface.</p>
          </div>
        </div>
        <div className="detail-fields-grid">
          {collectionFields.map(renderFieldRow)}
        </div>
      </section>

      {notice ? <div className={`status-note status-note-${notice.tone}`}>{notice.text}</div> : null}
    </form>
  );
}

