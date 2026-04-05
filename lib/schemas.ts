import { z } from "zod";

export const saveDraftSchema = z.object({
  draftId: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(["owned", "wishlist"]),
  fillState: z.enum(["sealed", "open", "finished"]),
  purchaseCurrency: z.string().min(3).max(3),
  purchasePrice: z.number().optional(),
  purchaseDate: z.string().optional(),
  purchaseSource: z.string().optional(),
  personalNotes: z.string().optional()
});

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
