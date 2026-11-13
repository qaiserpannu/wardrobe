import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core";
import {
  type HoldInput,
  MAX_PHOTOS,
  type ProductInput,
  type ProductStatus,
  STATUS_LABELS,
  STATUS_TRANSITIONS,
} from "@/lib/product-form";
import { slugify } from "@/lib/slug";
import { getDb } from "@/server/db/client";
import { adminUsers, categories, productHolds, productImages, products, productStatusEvents } from "@/server/db/schema";
import { processProductPhoto } from "@/server/images/process";
import { getStorage } from "@/server/storage";
import type { AdminUser } from "./admin-auth";
import { recordAudit } from "./audit";
import { ensureHoldsCurrent } from "./hold-expiry";
import { getSettings } from "./settings";

/**
 * ADMIN ONLY. Everything here can see drafts, archived items and hold
 * details. Never import this from public pages, the chat API or the agent.
 * Callers must have checked requireAdmin() and pass the administrator in.
 */

/** A problem the owner can fix; the message is shown to them as written. */
export class AdminActionError extends Error {}

export type AdminImage = { id: string; url: string; width: number; height: number };

export type AdminHold = {
  id: string;
  customerName: string;
  customerContact: string | null;
  note: string | null;
  heldAt: Date;
  expiresAt: Date | null;
};

export type AdminStatusEvent = {
  id: string;
  fromStatus: ProductStatus | null;
  toStatus: ProductStatus;
  note: string | null;
  adminName: string | null;
  createdAt: Date;
};

export type AdminProductSummary = {
  id: string;
  code: string;
  slug: string;
  name: string;
  status: ProductStatus;
  priceCents: number;
  size: string | null;
  categoryName: string;
  isFeatured: boolean;
  updatedAt: Date;
  cover: AdminImage | null;
  /** Only for items on hold. */
  heldFor: string | null;
  holdExpiresAt: Date | null;
};

export type AdminProduct = ProductInput & {
  id: string;
  code: string;
  slug: string;
  status: ProductStatus;
  categoryName: string;
  publishedAt: Date | null;
  soldAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  images: AdminImage[];
  hold: AdminHold | null;
  history: AdminStatusEvent[];
};

export type CategoryOption = { id: string; label: string; isActive: boolean };

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ADMIN_PAGE_SIZE = 20;

const parents = alias(categories, "parent_categories");

function toImage(row: { id: string; storageKey: string; width: number; height: number }): AdminImage {
  return { id: row.id, url: getStorage().publicUrl(row.storageKey), width: row.width, height: row.height };
}

/** Categories an item can be put in: every category that is not a group containing others. */
export async function listCategoryOptions(): Promise<CategoryOption[]> {
  const rows = await getDb()
    .select({
      id: categories.id,
      name: categories.name,
      parentId: categories.parentId,
      isActive: categories.isActive,
      parentName: parents.name,
      parentActive: parents.isActive,
      parentOrder: parents.sortOrder,
      sortOrder: categories.sortOrder,
    })
    .from(categories)
    .leftJoin(parents, eq(categories.parentId, parents.id))
    .orderBy(asc(sql`coalesce(${parents.sortOrder}, ${categories.sortOrder})`), asc(categories.sortOrder), asc(categories.name));
  const hasChildren = new Set(rows.map((r) => r.parentId).filter(Boolean));
  return rows
    .filter((r) => !hasChildren.has(r.id))
    .map((r) => ({
      id: r.id,
      label: r.parentName ? `${r.parentName} · ${r.name}` : r.name,
      isActive: r.isActive && (r.parentActive ?? true),
    }));
}

export async function listAdminProducts(filter: { status?: ProductStatus; search?: string; page?: number }): Promise<{
  items: AdminProductSummary[];
  total: number;
  page: number;
  pageCount: number;
}> {
  await ensureHoldsCurrent();
  const db = getDb();
  const search = filter.search?.trim().slice(0, 100);
  const like = search ? `%${search.replace(/[\\%_]/g, "\\$&")}%` : null;
  const where = and(
    filter.status ? eq(products.status, filter.status) : undefined,
    like ? or(ilike(products.name, like), ilike(products.code, like), ilike(products.brand, like)) : undefined,
  );

  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(products).where(where);
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(filter.page ?? 1) || 1), pageCount);

  const rows = await db
    .select({
      id: products.id,
      code: products.code,
      slug: products.slug,
      name: products.name,
      status: products.status,
      priceCents: products.priceCents,
      size: products.size,
      categoryName: categories.name,
      isFeatured: products.isFeatured,
      updatedAt: products.updatedAt,
      heldFor: productHolds.customerName,
      holdExpiresAt: productHolds.expiresAt,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(productHolds, and(eq(productHolds.productId, products.id), isNull(productHolds.endedAt)))
    .where(where)
    .orderBy(desc(products.updatedAt), desc(products.code))
    .limit(ADMIN_PAGE_SIZE)
    .offset((page - 1) * ADMIN_PAGE_SIZE);

  const covers = new Map<string, AdminImage>();
  if (rows.length > 0) {
    const images = await db
      .select()
      .from(productImages)
      .where(
        inArray(
          productImages.productId,
          rows.map((r) => r.id),
        ),
      )
      .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt));
    for (const img of images) if (!covers.has(img.productId)) covers.set(img.productId, toImage(img));
  }
  return { items: rows.map((r) => ({ ...r, cover: covers.get(r.id) ?? null })), total, page, pageCount };
}

export async function getAdminProduct(id: string): Promise<AdminProduct | null> {
  if (!ID_PATTERN.test(id)) return null;
  await ensureHoldsCurrent();
  const db = getDb();
  const [row] = await db
    .select({ product: products, categoryName: categories.name })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.id, id));
  if (!row) return null;

  const [images, [hold], history] = await Promise.all([
    db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(asc(productImages.sortOrder), asc(productImages.createdAt)),
    db.select().from(productHolds).where(and(eq(productHolds.productId, id), isNull(productHolds.endedAt))),
    db
      .select({
        id: productStatusEvents.id,
        fromStatus: productStatusEvents.fromStatus,
        toStatus: productStatusEvents.toStatus,
        note: productStatusEvents.note,
        adminName: adminUsers.name,
        createdAt: productStatusEvents.createdAt,
      })
      .from(productStatusEvents)
      .leftJoin(adminUsers, eq(productStatusEvents.adminUserId, adminUsers.id))
      .where(eq(productStatusEvents.productId, id))
      .orderBy(desc(productStatusEvents.createdAt))
      .limit(50),
  ]);

  const p = row.product;
  return {
    id: p.id,
    code: p.code,
    slug: p.slug,
    status: p.status,
    name: p.name,
    description: p.description,
    categoryId: p.categoryId,
    categoryName: row.categoryName,
    brand: p.brand,
    size: p.size,
    color: p.color,
    fabric: p.fabric,
    pieces: p.pieces,
    stitching: p.stitching,
    occasion: p.occasion,
    imperfections: p.imperfections,
    condition: p.condition,
    priceCents: p.priceCents,
    isFeatured: p.isFeatured,
    publishedAt: p.publishedAt,
    soldAt: p.soldAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    images: images.map(toImage),
    hold: hold
      ? {
          id: hold.id,
          customerName: hold.customerName,
          customerContact: hold.customerContact,
          note: hold.note,
          heldAt: hold.heldAt,
          expiresAt: hold.expiresAt,
        }
      : null,
    history,
  };
}

async function assertCategory(categoryId: string): Promise<void> {
  const options = await listCategoryOptions();
  if (!options.some((o) => o.id === categoryId)) throw new AdminActionError("Choose a category from the list.");
}

const slugFor = (name: string, code: string) => `${slugify(name) || "item"}-${code.toLowerCase()}`;

/** New items always start as drafts, invisible to the public. */
export async function createProduct(admin: AdminUser, input: ProductInput): Promise<{ id: string; code: string }> {
  await assertCategory(input.categoryId);
  const db = getDb();
  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(products)
      .values({ ...input, slug: `new-${crypto.randomUUID()}`, status: "draft" })
      .returning({ id: products.id, code: products.code });
    await tx.update(products).set({ slug: slugFor(input.name, row.code) }).where(eq(products.id, row.id));
    await tx.insert(productStatusEvents).values({ productId: row.id, fromStatus: null, toStatus: "draft", adminUserId: admin.id, note: "Created" });
    return row;
  });
  await recordAudit({
    adminUserId: admin.id,
    action: "product.create",
    entityType: "product",
    entityId: created.id,
    summary: `${created.code} ${input.name}: created as a draft`,
  });
  return created;
}

export async function updateProduct(admin: AdminUser, id: string, input: ProductInput): Promise<void> {
  const before = await getAdminProduct(id);
  if (!before) throw new AdminActionError("This item no longer exists.");
  if (input.categoryId !== before.categoryId) await assertCategory(input.categoryId);

  const changed: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(input) as (keyof ProductInput)[]) {
    if (before[key] !== input[key]) changed[key] = { from: before[key], to: input[key] };
  }
  if (Object.keys(changed).length === 0) return;

  // The web address stays the same once an item has been published, so shared links keep working.
  const slug = before.publishedAt ? before.slug : slugFor(input.name, before.code);
  await getDb()
    .update(products)
    .set({ ...input, slug })
    .where(eq(products.id, id));
  await recordAudit({
    adminUserId: admin.id,
    action: "product.update",
    entityType: "product",
    entityId: id,
    summary: `${before.code} ${input.name}: details changed (${Object.keys(changed).join(", ")})`,
    details: changed,
  });
}

/**
 * The one place a product's status changes. Checks the move is allowed,
 * keeps hold records in step, and writes the history.
 */
export async function changeProductStatus(
  admin: AdminUser,
  id: string,
  to: ProductStatus,
  options: { hold?: HoldInput } = {},
): Promise<void> {
  if (!ID_PATTERN.test(id)) throw new AdminActionError("This item no longer exists.");
  await ensureHoldsCurrent();
  const settings = await getSettings();
  const db = getDb();

  const result = await db.transaction(async (tx) => {
    const [product] = await tx.select().from(products).where(eq(products.id, id)).for("update");
    if (!product) throw new AdminActionError("This item no longer exists.");
    const from = product.status;
    if (!STATUS_TRANSITIONS[from].includes(to)) {
      throw new AdminActionError(`An item that is "${STATUS_LABELS[from]}" cannot be changed to "${STATUS_LABELS[to]}".`);
    }

    if (to === "available" && from === "draft") {
      const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(productImages).where(eq(productImages.productId, id));
      if (n === 0) throw new AdminActionError("Add at least one photo before publishing.");
    }

    const now = new Date();
    if (from === "pending") {
      await tx
        .update(productHolds)
        .set({ endedAt: now, endReason: to === "sold" ? "sold" : to === "archived" ? "archived" : "released" })
        .where(and(eq(productHolds.productId, id), isNull(productHolds.endedAt)));
    }
    if (to === "pending") {
      if (!options.hold) throw new AdminActionError("Enter who the item is held for.");
      const expiresAt = options.hold.expiresAt ?? new Date(now.getTime() + settings.holds.expiryHours * 60 * 60 * 1000);
      if (expiresAt <= now) throw new AdminActionError("The hold must end at a time in the future.");
      await tx.insert(productHolds).values({
        productId: id,
        customerName: options.hold.customerName,
        customerContact: options.hold.customerContact,
        note: options.hold.note,
        heldAt: now,
        expiresAt,
        createdBy: admin.id,
      });
    }

    await tx
      .update(products)
      .set({
        status: to,
        publishedAt: to === "available" ? (product.publishedAt ?? now) : product.publishedAt,
        soldAt: to === "sold" ? now : from === "sold" ? null : product.soldAt,
      })
      .where(eq(products.id, id));
    await tx.insert(productStatusEvents).values({ productId: id, fromStatus: from, toStatus: to, adminUserId: admin.id });
    return { from, code: product.code, name: product.name };
  });

  // No customer details in the audit line: hold details stay in the hold record.
  await recordAudit({
    adminUserId: admin.id,
    action: "product.status",
    entityType: "product",
    entityId: id,
    summary: `${result.code} ${result.name}: ${STATUS_LABELS[result.from]} → ${STATUS_LABELS[to]}`,
    details: { from: result.from, to },
  });
}

/** Change who an item is held for, the note, or when the hold ends (extend it). */
export async function updateHold(admin: AdminUser, productId: string, input: HoldInput): Promise<void> {
  if (!ID_PATTERN.test(productId)) throw new AdminActionError("This item no longer exists.");
  if (input.expiresAt && input.expiresAt <= new Date()) throw new AdminActionError("The hold must end at a time in the future.");
  const [updated] = await getDb()
    .update(productHolds)
    .set({
      customerName: input.customerName,
      customerContact: input.customerContact,
      note: input.note,
      ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
    })
    .where(and(eq(productHolds.productId, productId), isNull(productHolds.endedAt)))
    .returning({ id: productHolds.id });
  if (!updated) throw new AdminActionError("This item is no longer on hold.");
  await recordAudit({
    adminUserId: admin.id,
    action: "product.hold_updated",
    entityType: "product",
    entityId: productId,
    summary: "Hold details updated",
  });
}

async function productForPhotos(id: string) {
  if (!ID_PATTERN.test(id)) throw new AdminActionError("This item no longer exists.");
  const [product] = await getDb()
    .select({ id: products.id, code: products.code, name: products.name, status: products.status })
    .from(products)
    .where(eq(products.id, id));
  if (!product) throw new AdminActionError("This item no longer exists.");
  return product;
}

/** Checks, re-encodes and stores one uploaded photo. Throws PhotoError if the file is not acceptable. */
export async function addProductPhoto(admin: AdminUser, productId: string, file: Buffer): Promise<AdminImage> {
  const product = await productForPhotos(productId);
  const db = getDb();
  const existing = await db.select({ sortOrder: productImages.sortOrder }).from(productImages).where(eq(productImages.productId, productId));
  if (existing.length >= MAX_PHOTOS) throw new AdminActionError(`An item can have up to ${MAX_PHOTOS} photos.`);

  const photo = await processProductPhoto(file);
  const key = `products/${product.code.toLowerCase()}/${photo.fingerprint}.webp`;
  await getStorage().put(key, photo.data, "image/webp");
  const [row] = await db
    .insert(productImages)
    .values({
      productId,
      storageKey: key,
      sortOrder: Math.max(-1, ...existing.map((e) => e.sortOrder)) + 1,
      width: photo.width,
      height: photo.height,
    })
    .returning();
  await db.update(products).set({ updatedAt: new Date() }).where(eq(products.id, productId));
  await recordAudit({
    adminUserId: admin.id,
    action: "product.photo_added",
    entityType: "product",
    entityId: productId,
    summary: `${product.code} ${product.name}: photo added`,
  });
  return toImage(row);
}

export async function removeProductPhoto(admin: AdminUser, productId: string, imageId: string): Promise<void> {
  const product = await productForPhotos(productId);
  if (!ID_PATTERN.test(imageId)) throw new AdminActionError("That photo no longer exists.");
  const db = getDb();
  const images = await db.select().from(productImages).where(eq(productImages.productId, productId));
  const image = images.find((i) => i.id === imageId);
  if (!image) throw new AdminActionError("That photo no longer exists.");
  if (images.length === 1 && (product.status === "available" || product.status === "pending")) {
    throw new AdminActionError("An item on the website needs at least one photo. Add another before removing this one.");
  }
  await db.delete(productImages).where(eq(productImages.id, imageId));
  // The same picture may have been uploaded twice; only remove the file when nothing else uses it.
  if (!images.some((i) => i.id !== imageId && i.storageKey === image.storageKey)) {
    await getStorage().delete(image.storageKey);
  }
  await db.update(products).set({ updatedAt: new Date() }).where(eq(products.id, productId));
  await recordAudit({
    adminUserId: admin.id,
    action: "product.photo_removed",
    entityType: "product",
    entityId: productId,
    summary: `${product.code} ${product.name}: photo removed`,
  });
}

/** Saves a new photo order. The first photo is the one shown in the shop's listings. */
export async function reorderProductPhotos(admin: AdminUser, productId: string, orderedIds: string[]): Promise<void> {
  const product = await productForPhotos(productId);
  const db = getDb();
  const images = await db.select({ id: productImages.id }).from(productImages).where(eq(productImages.productId, productId));
  const known = new Set(images.map((i) => i.id));
  if (orderedIds.length !== known.size || new Set(orderedIds).size !== known.size || !orderedIds.every((id) => known.has(id))) {
    throw new AdminActionError("The photos changed while you were arranging them. Please reload the page.");
  }
  await db.transaction(async (tx) => {
    for (const [index, id] of orderedIds.entries()) {
      await tx.update(productImages).set({ sortOrder: index }).where(eq(productImages.id, id));
    }
    await tx.update(products).set({ updatedAt: new Date() }).where(eq(products.id, productId));
  });
  await recordAudit({
    adminUserId: admin.id,
    action: "product.photos_reordered",
    entityType: "product",
    entityId: productId,
    summary: `${product.code} ${product.name}: photos rearranged`,
  });
}

/** Values already used in the shop, offered as suggestions in the product form. */
export async function listFieldSuggestions(): Promise<{ brands: string[]; sizes: string[]; colors: string[]; fabrics: string[] }> {
  const db = getDb();
  const distinct = async (column: AnyPgColumn) => {
    const rows = await db.selectDistinct({ value: column }).from(products).where(sql`${column} is not null and ${column} <> ''`).orderBy(asc(column)).limit(200);
    return rows.map((r) => r.value as string);
  };
  const [brands, sizes, colors, fabrics] = await Promise.all([
    distinct(products.brand),
    distinct(products.size),
    distinct(products.color),
    distinct(products.fabric),
  ]);
  return { brands, sizes, colors, fabrics };
}

/**
 * The item as the public product page would show it, whatever its status, so
 * the owner can preview a draft. Never includes hold details.
 */
export async function getProductPreview(id: string) {
  const product = await getAdminProduct(id);
  if (!product) return null;
  const [category] = await getDb()
    .select({ name: categories.name, slug: categories.slug, groupName: parents.name, groupSlug: parents.slug })
    .from(categories)
    .leftJoin(parents, eq(categories.parentId, parents.id))
    .where(eq(categories.id, product.categoryId));
  return {
    realStatus: product.status,
    product: {
      code: product.code,
      slug: product.slug,
      name: product.name,
      description: product.description,
      category: { name: category.name, slug: category.slug },
      group: category.groupName && category.groupSlug ? { name: category.groupName, slug: category.groupSlug } : null,
      brand: product.brand,
      size: product.size,
      color: product.color,
      fabric: product.fabric,
      pieces: product.pieces,
      stitching: product.stitching,
      occasion: product.occasion,
      imperfections: product.imperfections?.trim() || null,
      condition: product.condition,
      priceCents: product.priceCents,
      // Drafts and archived items are previewed as they would look once available.
      status: product.status === "pending" || product.status === "sold" ? product.status : ("available" as const),
      isFeatured: product.isFeatured,
      publishedAt: product.publishedAt,
      images: product.images.map((img) => ({ url: img.url, alt: product.name, width: img.width, height: img.height })),
    },
  };
}
