import { z } from "zod";
import {
  BOTTLER_KIND_VALUES,
  CASK_INFLUENCE_VALUES,
  PEAT_LEVEL_VALUES,
  WHISKY_TYPE_VALUES
} from "@/lib/types";

const bottleRecordSchema = z.object({
  distilleryName: z.string().min(1),
  bottlerName: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().optional(),
  releaseSeries: z.string().optional(),
  bottlerKind: z.enum(BOTTLER_KIND_VALUES),
  whiskyType: z.enum(WHISKY_TYPE_VALUES),
  country: z.string().min(1),
  region: z.string().min(1),
  abv: z.number().optional(),
  ageStatement: z.number().int().positive().optional(),
  isNas: z.boolean(),
  vintageYear: z.number().optional(),
  distilledYear: z.number().optional(),
  bottledYear: z.number().optional(),
  volumeMl: z.number().int().positive().optional(),
  caskType: z.string().optional(),
  caskNumber: z.string().optional(),
  bottleNumber: z.number().int().positive().optional(),
  outturn: z.number().int().positive().optional(),
  barcode: z.string().optional(),
  peatLevel: z.enum(PEAT_LEVEL_VALUES),
  caskInfluence: z.enum(CASK_INFLUENCE_VALUES),
  isChillFiltered: z.boolean(),
  isNaturalColor: z.boolean(),
  isLimited: z.boolean(),
  flavorTags: z.array(z.string()),
  description: z.string().optional(),
  status: z.enum(["owned", "wishlist"]),
  fillState: z.enum(["sealed", "open", "finished"]),
  purchaseCurrency: z.string().min(3).max(3),
  purchasePrice: z.number().optional(),
  purchaseDate: z.string().optional(),
  purchaseSource: z.string().optional(),
  personalNotes: z.string().optional(),
  frontImageUrl: z.string().optional(),
  frontImageLabel: z.string().optional()
});

export const saveDraftSchema = bottleRecordSchema.extend({
  draftId: z.string().min(1)
});

export const updateItemSchema = bottleRecordSchema;

export const tastingSchema = z.object({
  tastedAt: z.string().min(1),
  nose: z.string().min(1),
  palate: z.string().min(1),
  finish: z.string().min(1),
  overallNote: z.string().min(1),
  rating: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5)
  ])
});

export const barcodeSchema = z.object({
  barcode: z.string().min(3)
});

export const compareSchema = z.object({
  leftId: z.string().min(1),
  rightId: z.string().min(1)
});
