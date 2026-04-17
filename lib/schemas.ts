import { z } from "zod";

function normalizeTagValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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
}, z.array(z.string().trim().min(1)).default([]).transform((value) => {
  const tags = value.map((entry) => normalizeTagValue(entry)).filter(Boolean);
  return [...new Set(tags)];
}));

const collectionStatusSchema = z.enum(["owned", "wishlist"]);
const fillStateSchema = z.enum(["sealed", "open", "finished"]);
const relationshipTypeSchema = z.enum(["friend", "family", "colleague", "other"]);
const occasionTypeSchema = z.enum(["visit", "whisky_friday", "other"]);

const bottlePayloadSchema = z
  .object({
    name: z.string().trim().min(1, "Bottle name is required"),
    distilleryName: optionalTextField,
    bottlerName: optionalTextField,
    brand: optionalTextField,
    country: optionalTextField,
    abv: optionalNumberField,
    ageStatement: optionalNumberField,
    barcode: optionalTextField,
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

export const ratingSchema = z
  .object({
    rating: z.number().int().min(1).max(3).nullable(),
    isFavorite: z.boolean().optional().default(false)
  })
  .strip()
  .refine(
    (data) => !data.isFavorite || data.rating === 3,
    { message: "Only 3-star bottles can be marked as a favorite", path: ["isFavorite"] }
  );

export const updateItemSchema = bottlePayloadSchema;

export const saveDraftSchema = bottlePayloadSchema.extend({
  draftId: z.string().trim().min(1, "Draft id is required")
});

const idListField = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}, z.array(z.string().trim().min(1)).default([]).transform((value) => [...new Set(value)]));

export const tastingPersonSchema = z
  .object({
    name: z.string().trim().min(1, "Person name is required"),
    relationshipType: relationshipTypeSchema.default("other"),
    preferenceTags: tagsField.default([]),
    notes: optionalTextField
  })
  .strip();

export const tastingGroupSchema = z
  .object({
    name: z.string().trim().min(1, "Group name is required"),
    notes: optionalTextField,
    memberPersonIds: idListField.default([])
  })
  .strip();

export const tastingPlaceSchema = z
  .object({
    name: z.string().trim().min(1, "Place name is required"),
    notes: optionalTextField
  })
  .strip();

export const tastingSessionSchema = z
  .object({
    title: optionalTextField,
    occasionType: occasionTypeSchema.default("other"),
    sessionDate: z.string().trim().min(1, "Session date is required"),
    placeId: optionalTextField,
    groupId: optionalTextField,
    notes: optionalTextField,
    attendeePersonIds: idListField.default([]),
    bottleItemIds: idListField
  })
  .strip()
  .refine((data) => data.bottleItemIds.length > 0, {
    message: "Select at least one bottle",
    path: ["bottleItemIds"]
  });

export const quickBottleShareSchema = z
  .object({
    title: optionalTextField,
    occasionType: occasionTypeSchema.default("visit"),
    sessionDate: z.string().trim().min(1, "Share date is required"),
    placeId: optionalTextField,
    groupId: optionalTextField,
    notes: optionalTextField,
    attendeePersonIds: idListField.default([]),
    collectionItemId: z.string().trim().min(1, "Bottle is required")
  })
  .strip()
  .refine((data) => data.attendeePersonIds.length > 0 || Boolean(data.groupId), {
    message: "Add at least one person or choose a group",
    path: ["attendeePersonIds"]
  });
