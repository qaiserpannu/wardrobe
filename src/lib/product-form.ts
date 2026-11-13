import { z } from "zod";
import { CONDITIONS } from "./conditions";
import { OCCASIONS, STITCHING } from "./product-options";

/** What the owner can type into the product form. Used by the form's server action and by tests. */

export const PRODUCT_STATUSES = ["draft", "available", "pending", "sold", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const STATUS_LABELS: Record<ProductStatus, string> = {
  draft: "Draft",
  available: "Available",
  pending: "On hold",
  sold: "Sold",
  archived: "Archived",
};

/** The only status changes allowed (D25). Archived items can be brought back as drafts. */
export const STATUS_TRANSITIONS: Record<ProductStatus, readonly ProductStatus[]> = {
  draft: ["available", "archived"],
  available: ["pending", "sold", "archived"],
  pending: ["available", "sold", "archived"],
  sold: ["available", "archived"],
  archived: ["draft"],
};

export const MAX_PHOTOS = 12;
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const MAX_PRICE_CENTS = 10_000_000;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable();

/** "45", "45.5", "$1,200.00" -> cents. Null if it is not a sensible price. */
export function parsePriceToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  return cents > 0 && cents <= MAX_PRICE_CENTS ? cents : null;
}

export const productInputSchema = z.object({
  name: z.string().trim().min(2, "Give the item a name.").max(120),
  description: z.string().trim().max(4000),
  categoryId: z.uuid("Choose a category."),
  brand: optionalText(60),
  size: optionalText(40),
  color: optionalText(40),
  fabric: optionalText(60),
  pieces: z
    .union([z.literal("").transform(() => null), z.coerce.number().int().min(1).max(12)])
    .nullable(),
  stitching: z.union([z.literal("").transform(() => null), z.enum(STITCHING)]).nullable(),
  occasion: z.union([z.literal("").transform(() => null), z.enum(OCCASIONS)]).nullable(),
  imperfections: optionalText(1000),
  condition: z.enum(CONDITIONS, "Choose a condition."),
  priceCents: z.number().int().positive().max(MAX_PRICE_CENTS),
  isFeatured: z.boolean(),
});
export type ProductInput = z.infer<typeof productInputSchema>;

export const holdInputSchema = z.object({
  customerName: z.string().trim().min(1, "Enter who the item is held for.").max(120),
  customerContact: optionalText(120),
  note: optionalText(1000),
  /** Left out = the shop's usual hold length from now. */
  expiresAt: z.date().nullable(),
});
export type HoldInput = z.infer<typeof holdInputSchema>;
