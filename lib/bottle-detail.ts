import { z } from "zod";

import type { CollectionViewItem } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export const bottleDetailFieldIds = [
  "frontImage",
  "distilleryName",
  "bottlerName",
  "brand",
  "name",
  "country",
  "abv",
  "ageStatement",
  "barcode",
  "tags",
  "description",
  "status",
  "fillState",
  "purchaseCurrency",
  "purchasePrice",
  "purchaseDate",
  "purchaseSource",
  "personalNotes"
] as const;

export type BottleDetailFieldId = (typeof bottleDetailFieldIds)[number];

export const aiBottleDetailFieldIds = [
  "distilleryName",
  "bottlerName",
  "brand",
  "name",
  "country",
  "abv",
  "ageStatement",
  "barcode",
  "tags",
  "description",
  "purchasePrice"
] as const;

export type AiBottleDetailFieldId = (typeof aiBottleDetailFieldIds)[number];
export type BottleDetailSectionId = "image" | "identity" | "specs" | "collection";
export type BottleDetailInputKind =
  | "image"
  | "text"
  | "number"
  | "textarea"
  | "select"
  | "tags"
  | "date";

export type BottleDetailFieldDefinition = {
  id: BottleDetailFieldId;
  label: string;
  section: BottleDetailSectionId;
  input: BottleDetailInputKind;
  fullSpan?: boolean;
  aiEnabled?: boolean;
};

export const bottleDetailFieldDefinitions = [
  {
    id: "frontImage",
    label: "Front image",
    section: "image",
    input: "image",
    fullSpan: true
  },
  {
    id: "name",
    label: "Bottle name",
    section: "identity",
    input: "text",
    fullSpan: true,
    aiEnabled: true
  },
  {
    id: "brand",
    label: "Brand",
    section: "identity",
    input: "text",
    aiEnabled: true
  },
  {
    id: "distilleryName",
    label: "Distillery",
    section: "identity",
    input: "text",
    aiEnabled: true
  },
  {
    id: "bottlerName",
    label: "Bottler",
    section: "identity",
    input: "text",
    aiEnabled: true
  },
  {
    id: "country",
    label: "Country",
    section: "specs",
    input: "text",
    aiEnabled: true
  },
  {
    id: "abv",
    label: "ABV",
    section: "specs",
    input: "number",
    aiEnabled: true
  },
  {
    id: "ageStatement",
    label: "Age statement",
    section: "specs",
    input: "number",
    aiEnabled: true
  },
  {
    id: "barcode",
    label: "Barcode",
    section: "specs",
    input: "text",
    aiEnabled: true
  },
  {
    id: "tags",
    label: "Tags",
    section: "specs",
    input: "tags",
    fullSpan: true,
    aiEnabled: true
  },
  {
    id: "description",
    label: "Description",
    section: "specs",
    input: "textarea",
    fullSpan: true,
    aiEnabled: true
  },
  {
    id: "status",
    label: "Status",
    section: "collection",
    input: "select"
  },
  {
    id: "fillState",
    label: "Bottle state",
    section: "collection",
    input: "select"
  },
  {
    id: "purchaseCurrency",
    label: "Currency",
    section: "collection",
    input: "text"
  },
  {
    id: "purchasePrice",
    label: "Purchase price",
    section: "collection",
    input: "number",
    aiEnabled: true
  },
  {
    id: "purchaseDate",
    label: "Purchase date",
    section: "collection",
    input: "date"
  },
  {
    id: "purchaseSource",
    label: "Purchase source",
    section: "collection",
    input: "text"
  },
  {
    id: "personalNotes",
    label: "Personal note",
    section: "collection",
    input: "textarea",
    fullSpan: true
  }
] as const satisfies readonly BottleDetailFieldDefinition[];

export const bottleDetailFormStateSchema = z
  .object({
    distilleryName: z.string(),
    bottlerName: z.string(),
    brand: z.string(),
    name: z.string(),
    country: z.string(),
    abv: z.string(),
    ageStatement: z.string(),
    barcode: z.string(),
    tags: z.string(),
    description: z.string(),
    status: z.enum(["owned", "wishlist"]),
    fillState: z.enum(["sealed", "open", "finished"]),
    purchaseCurrency: z.string(),
    purchasePrice: z.string(),
    purchaseDate: z.string(),
    purchaseSource: z.string(),
    personalNotes: z.string()
  })
  .strip();

export type BottleDetailFormState = z.infer<typeof bottleDetailFormStateSchema>;

export const enrichBottleFieldRequestSchema = z
  .object({
    field: z.enum(aiBottleDetailFieldIds),
    currentValue: z.union([z.string(), z.number(), z.array(z.string()), z.null()]).optional(),
    draftValues: bottleDetailFormStateSchema
  })
  .strip();

export type BottleSuggestionDiff =
  | {
      kind: "text";
      current: string;
      suggested: string;
      removedText: string;
      addedText: string;
    }
  | {
      kind: "tags";
      current: string[];
      suggested: string[];
      removed: string[];
      added: string[];
    }
  | {
      kind: "scalar";
      current: string;
      suggested: string;
    };

export type BottleSuggestionCitation = {
  label: string;
  url: string;
  snippet: string;
};

export type BottleFieldSuggestionResponse = {
  field: AiBottleDetailFieldId;
  status: "suggestion" | "no_suggestion";
  suggestedValue: string | number | string[] | null;
  confidence: number | null;
  rationale: string;
  citations: BottleSuggestionCitation[];
  diff: BottleSuggestionDiff | null;
  priceContext?: "za-market-reference";
};

export function isAiBottleDetailField(field: BottleDetailFieldId): field is AiBottleDetailFieldId {
  return aiBottleDetailFieldIds.includes(field as AiBottleDetailFieldId);
}

export function getBottleDetailFieldDefinition(field: BottleDetailFieldId) {
  return bottleDetailFieldDefinitions.find((entry) => entry.id === field);
}

export function buildBottleDetailFormState(entry: CollectionViewItem): BottleDetailFormState {
  return {
    distilleryName: entry.expression.distilleryName ?? "",
    bottlerName: entry.expression.bottlerName ?? "",
    brand: entry.expression.brand ?? "",
    name: entry.expression.name,
    country: entry.expression.country ?? "",
    abv: entry.expression.abv === undefined ? "" : String(entry.expression.abv),
    ageStatement: entry.expression.ageStatement === undefined ? "" : String(entry.expression.ageStatement),
    barcode: entry.expression.barcode ?? "",
    tags: (entry.expression.tags ?? []).join(", "),
    description: entry.expression.description ?? "",
    status: entry.item.status,
    fillState: entry.item.fillState,
    purchaseCurrency: entry.item.purchaseCurrency ?? "ZAR",
    purchasePrice: entry.item.purchasePrice === undefined ? "" : String(entry.item.purchasePrice),
    purchaseDate: entry.item.purchaseDate?.slice(0, 10) ?? "",
    purchaseSource: entry.item.purchaseSource ?? "",
    personalNotes: entry.item.personalNotes ?? ""
  };
}

export function parseTagsText(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function normalizeTextValue(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

export function normalizeNumberValue(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function getFieldRawValue(
  field: AiBottleDetailFieldId,
  formValues: BottleDetailFormState
): string | number | string[] | null {
  switch (field) {
    case "abv":
    case "ageStatement":
    case "purchasePrice":
      return normalizeNumberValue(formValues[field]);
    case "tags":
      return parseTagsText(formValues.tags);
    default:
      return normalizeTextValue(formValues[field]);
  }
}

export function normalizeSuggestedValue(
  field: AiBottleDetailFieldId,
  value: unknown
): string | number | string[] | null {
  if (field === "tags") {
    if (!Array.isArray(value)) {
      return null;
    }

    return value
      .map((tag) => String(tag).trim().toLowerCase().replace(/\s+/g, "-"))
      .filter(Boolean);
  }

  if (field === "abv" || field === "ageStatement" || field === "purchasePrice") {
    return normalizeNumberValue(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  return value.trim();
}

export function serializeSuggestionValue(
  field: AiBottleDetailFieldId,
  value: string | number | string[] | null
) {
  if (field === "tags") {
    return Array.isArray(value) ? value.join(", ") : "";
  }

  if (typeof value === "number") {
    return String(value);
  }

  return typeof value === "string" ? value : "";
}

function stringifyScalar(value: unknown) {
  if (typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return typeof value === "string" ? value : "";
}

function buildTextDiff(current: string, suggested: string): BottleSuggestionDiff {
  const currentTokens = current.split(/\s+/).filter(Boolean);
  const suggestedTokens = suggested.split(/\s+/).filter(Boolean);

  let start = 0;
  while (
    start < currentTokens.length &&
    start < suggestedTokens.length &&
    currentTokens[start] === suggestedTokens[start]
  ) {
    start += 1;
  }

  let currentEnd = currentTokens.length - 1;
  let suggestedEnd = suggestedTokens.length - 1;
  while (
    currentEnd >= start &&
    suggestedEnd >= start &&
    currentTokens[currentEnd] === suggestedTokens[suggestedEnd]
  ) {
    currentEnd -= 1;
    suggestedEnd -= 1;
  }

  return {
    kind: "text",
    current,
    suggested,
    removedText: currentTokens.slice(start, currentEnd + 1).join(" "),
    addedText: suggestedTokens.slice(start, suggestedEnd + 1).join(" ")
  };
}

export function buildSuggestionDiff(
  field: AiBottleDetailFieldId,
  currentValue: string | number | string[] | null,
  suggestedValue: string | number | string[] | null
): BottleSuggestionDiff | null {
  if (suggestedValue === null) {
    return null;
  }

  if (field === "tags") {
    const current = Array.isArray(currentValue) ? currentValue : [];
    const suggested = Array.isArray(suggestedValue) ? suggestedValue : [];
    return {
      kind: "tags",
      current,
      suggested,
      removed: current.filter((tag) => !suggested.includes(tag)),
      added: suggested.filter((tag) => !current.includes(tag))
    };
  }

  if (field === "abv" || field === "ageStatement" || field === "purchasePrice") {
    return {
      kind: "scalar",
      current: stringifyScalar(currentValue),
      suggested: stringifyScalar(suggestedValue)
    };
  }

  return buildTextDiff(stringifyScalar(currentValue), stringifyScalar(suggestedValue));
}

export function areSuggestionValuesEqual(
  field: AiBottleDetailFieldId,
  currentValue: string | number | string[] | null,
  suggestedValue: string | number | string[] | null
) {
  if (currentValue === null && suggestedValue === null) {
    return true;
  }

  if (field === "tags") {
    const current = [...(Array.isArray(currentValue) ? currentValue : [])].sort();
    const suggested = [...(Array.isArray(suggestedValue) ? suggestedValue : [])].sort();
    return JSON.stringify(current) === JSON.stringify(suggested);
  }

  return stringifyScalar(currentValue) === stringifyScalar(suggestedValue);
}

export function formatFieldValue(
  field: BottleDetailFieldId,
  formValues: BottleDetailFormState
) {
  switch (field) {
    case "frontImage":
      return "Front image";
    case "status":
      return formValues.status === "wishlist" ? "Wishlist" : "Owned";
    case "fillState":
      return formValues.fillState === "open"
        ? "Open"
        : formValues.fillState === "finished"
          ? "Finished"
          : "Sealed";
    case "purchaseDate":
      return formValues.purchaseDate ? formatDate(formValues.purchaseDate) : "Not set";
    case "purchasePrice": {
      const parsed = normalizeNumberValue(formValues.purchasePrice);
      return parsed === null
        ? "Not set"
        : formatCurrency(parsed, formValues.purchaseCurrency.trim().toUpperCase() || "ZAR");
    }
    case "purchaseCurrency":
      return formValues.purchaseCurrency.trim().toUpperCase() || "Not set";
    case "abv":
      return formValues.abv.trim() ? `${formValues.abv.trim()}% ABV` : "Not set";
    case "ageStatement":
      return formValues.ageStatement.trim() ? `${formValues.ageStatement.trim()} years` : "Not set";
    case "tags": {
      const tags = parseTagsText(formValues.tags);
      return tags.length > 0 ? tags.join(", ") : "Not set";
    }
    default: {
      const value = formValues[field as keyof BottleDetailFormState];
      return typeof value === "string" && value.trim().length > 0 ? value.trim() : "Not set";
    }
  }
}

export function formatSuggestionValueForDisplay(
  field: AiBottleDetailFieldId,
  value: string | number | string[] | null,
  options?: { purchaseCurrency?: string }
) {
  if (value === null) {
    return "Not set";
  }

  if (field === "tags") {
    return Array.isArray(value) && value.length > 0 ? value.join(", ") : "Not set";
  }

  if (field === "purchasePrice" && typeof value === "number") {
    return formatCurrency(value, options?.purchaseCurrency ?? "ZAR");
  }

  if (field === "abv" && typeof value === "number") {
    return `${value}% ABV`;
  }

  if (field === "ageStatement" && typeof value === "number") {
    return `${value} years`;
  }

  return stringifyScalar(value) || "Not set";
}
