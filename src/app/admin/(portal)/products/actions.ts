"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  holdInputSchema,
  parsePriceToCents,
  PRODUCT_STATUSES,
  productInputSchema,
  type HoldInput,
} from "@/lib/product-form";
import { requireAdmin } from "@/server/auth/session";
import {
  AdminActionError,
  changeProductStatus,
  createProduct,
  removeProductPhoto,
  reorderProductPhotos,
  updateHold,
  updateProduct,
} from "@/server/services/admin-products";
import { CACHE_TAGS } from "@/server/services/cached";

export type ActionState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
  /** What was typed, handed back so a failed save does not clear the form. */
  values?: Record<string, string>;
};

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

/** Turns a known problem into a message; anything unexpected is rethrown (redirects included). */
function failure(error: unknown): ActionState {
  if (error instanceof AdminActionError) return { error: error.message };
  throw error;
}

export async function saveProductAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = text(formData, "id");
  const priceCents = parsePriceToCents(text(formData, "price"));
  const typed: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$")) typed[key] = value.slice(0, 5000);
  }

  const parsed = productInputSchema.safeParse({
    name: text(formData, "name"),
    description: text(formData, "description"),
    categoryId: text(formData, "categoryId"),
    brand: text(formData, "brand"),
    size: text(formData, "size"),
    color: text(formData, "color"),
    fabric: text(formData, "fabric"),
    pieces: text(formData, "pieces"),
    stitching: text(formData, "stitching"),
    occasion: text(formData, "occasion"),
    imperfections: text(formData, "imperfections"),
    condition: text(formData, "condition"),
    priceCents: priceCents ?? 0,
    isFeatured: formData.get("isFeatured") === "on",
  });

  const fieldErrors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0]);
      if (field !== "priceCents") fieldErrors[field] ??= issue.message;
    }
  }
  if (priceCents === null) fieldErrors.price = "Enter a price, for example 45 or 45.50.";
  if (!parsed.success || priceCents === null) {
    return { error: "Please check the highlighted boxes.", fieldErrors, values: typed };
  }

  let createdId: string | null = null;
  try {
    if (id) await updateProduct(admin, id, parsed.data);
    else createdId = (await createProduct(admin, parsed.data)).id;
  } catch (error) {
    return { ...failure(error), values: typed };
  }
  updateTag(CACHE_TAGS.categories);
  if (createdId) redirect(`/admin/products/${createdId}?created=1`);
  refresh();
  return { success: "Saved." };
}

const HOLD_HOURS = [24, 48, 72, 120, 168] as const;

function readHold(formData: FormData): { ok: true; hold: HoldInput } | { ok: false; error: string } {
  const hoursRaw = text(formData, "holdHours");
  const hours = hoursRaw === "" ? null : Number(hoursRaw);
  if (hours !== null && !HOLD_HOURS.includes(hours as (typeof HOLD_HOURS)[number])) {
    return { ok: false, error: "Choose how long to hold the item." };
  }
  const parsed = holdInputSchema.safeParse({
    customerName: text(formData, "customerName"),
    customerContact: text(formData, "customerContact"),
    note: text(formData, "note"),
    expiresAt: hours === null ? null : new Date(Date.now() + hours * 60 * 60 * 1000),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the hold details." };
  return { ok: true, hold: parsed.data };
}

export async function changeStatusAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const to = z.enum(PRODUCT_STATUSES).safeParse(text(formData, "to"));
  if (!to.success) return { error: "That status change is not possible." };

  let hold: HoldInput | undefined;
  if (to.data === "pending") {
    const read = readHold(formData);
    if (!read.ok) return { error: read.error };
    hold = read.hold;
  }
  try {
    await changeProductStatus(admin, text(formData, "id"), to.data, { hold });
  } catch (error) {
    return failure(error);
  }
  updateTag(CACHE_TAGS.categories);
  refresh();
  return { success: "Status changed." };
}

export async function updateHoldAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const read = readHold(formData);
  if (!read.ok) return { error: read.error };
  try {
    await updateHold(admin, text(formData, "id"), read.hold);
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { success: "Hold updated." };
}

export async function removePhotoAction(productId: string, imageId: string): Promise<ActionState> {
  const admin = await requireAdmin();
  try {
    await removeProductPhoto(admin, String(productId), String(imageId));
  } catch (error) {
    return failure(error);
  }
  refresh();
  return {};
}

export async function reorderPhotosAction(productId: string, orderedIds: string[]): Promise<ActionState> {
  const admin = await requireAdmin();
  const ids = z.array(z.string().max(60)).max(50).safeParse(orderedIds);
  if (!ids.success) return { error: "The photo order could not be saved." };
  try {
    await reorderProductPhotos(admin, String(productId), ids.data);
  } catch (error) {
    return failure(error);
  }
  refresh();
  return {};
}
