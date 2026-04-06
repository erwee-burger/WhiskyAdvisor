import { z } from "zod";

const optionalTextField = z.preprocess((value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().min(1).optional());

const optionalNumberField = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}, z.number().finite().optional());

const optionalBooleanField = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}, z.boolean().optional());

const tagsField = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}, z.array(z.string().trim().min(1)).default([]));

const collectionStatusSchema = z.enum(["owned", "wishlist"]);
const fillStateSchema = z.enum(["sealed", "open", "finished"]);

const bottlePayloadSchema = z
  .object({
    name: z.string().trim().min(1, "Bottle name is required"),
    distilleryName: optionalTextField,
    bottlerName: optionalTextField,
    brand: optionalTextField,
    country: optionalTextField,
    abv: optionalNumberField,
    ageStatement: optionalNumberField,
    releaseSeries: optionalTextField,
    bottlerKind: optionalTextField,
    whiskyType: optionalTextField,
    region: optionalTextField,
    volumeMl: optionalNumberField,
    vintageYear: optionalNumberField,
    distilledYear: optionalNumberField,
    bottledYear: optionalNumberField,
    caskType: optionalTextField,
    caskNumber: optionalTextField,
    bottleNumber: optionalNumberField,
    outturn: optionalNumberField,
    barcode: optionalTextField,
    peatLevel: optionalTextField,
    caskInfluence: optionalTextField,
    isNas: optionalBooleanField,
    isChillFiltered: optionalBooleanField,
    isNaturalColor: optionalBooleanField,
    isLimited: optionalBooleanField,
    flavorTags: tagsField,
    description: optionalTextField,
    tags: tagsField,
    status: collectionStatusSchema,
    fillState: fillStateSchema,
    purchaseCurrency: z.string().trim().min(1, "Currency is required"),
    purchasePrice: optionalNumberField,
    purchaseDate: optionalTextField,
    purchaseSource: optionalTextField,
    personalNotes: optionalTextField,
    frontImageUrl: optionalTextField,
    frontImageLabel: optionalTextField
  })
  .strip();

export const intakePhotoSchema = z
  .object({
    fileName: z.string().trim().min(1, "A file name or label description is required"),
    imageBase64: optionalTextField,
    imageMimeType: optionalTextField
  })
  .strip();

export const barcodeSchema = z
  .object({
    barcode: z.string().trim().min(1, "Barcode is required")
  })
  .strip();

export const compareSchema = z
  .object({
    leftId: z.string().trim().min(1, "Left whisky is required"),
    rightId: z.string().trim().min(1, "Right whisky is required")
  })
  .strip();

export const tastingSchema = z
  .object({
    tastedAt: z.string().trim().min(1, "Tasted date is required"),
    nose: z.string().trim().min(1, "Nose notes are required"),
    palate: z.string().trim().min(1, "Palate notes are required"),
    finish: z.string().trim().min(1, "Finish notes are required"),
    overallNote: z.string().trim().min(1, "Overall note is required"),
    rating: z.number().int().min(1).max(5)
  })
  .strip();

export const updateItemSchema = bottlePayloadSchema;

export const saveDraftSchema = bottlePayloadSchema.extend({
  draftId: z.string().trim().min(1, "Draft id is required")
});
