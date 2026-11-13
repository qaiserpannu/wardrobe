import "server-only";
import { asc, eq, isNull, sql } from "drizzle-orm";
import { slugify } from "@/lib/slug";
import { getDb } from "@/server/db/client";
import { categories, products } from "@/server/db/schema";
import type { AdminUser } from "./admin-auth";
import { AdminActionError } from "./admin-products";
import { recordAudit } from "./audit";

/**
 * ADMIN ONLY: category management. Two levels: groups (Women, Men...) and the
 * categories inside them. Items live in categories that have nothing inside
 * them. Nothing is deleted; a category is hidden instead.
 */

export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  /** Items of any status directly in this category. */
  itemCount: number;
};
export type AdminCategoryGroup = AdminCategory & { children: AdminCategory[] };

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAME_MAX = 40;

type Row = AdminCategory & { parentId: string | null; sortOrder: number };

async function allRows(): Promise<Row[]> {
  return getDb()
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      isActive: categories.isActive,
      parentId: categories.parentId,
      sortOrder: categories.sortOrder,
      itemCount: sql<number>`count(${products.id})::int`,
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function listAdminCategories(): Promise<AdminCategoryGroup[]> {
  const rows = await allRows();
  const strip = ({ id, name, slug, isActive, itemCount }: Row): AdminCategory => ({ id, name, slug, isActive, itemCount });
  return rows.filter((r) => !r.parentId).map((group) => ({ ...strip(group), children: rows.filter((r) => r.parentId === group.id).map(strip) }));
}

function cleanName(input: string): string {
  const name = input.trim().replace(/\s+/g, " ");
  if (name.length < 2) throw new AdminActionError("Enter a name of at least 2 characters.");
  if (name.length > NAME_MAX) throw new AdminActionError(`Use at most ${NAME_MAX} characters.`);
  return name;
}

function find(rows: Row[], id: string): Row {
  const row = ID_PATTERN.test(id) ? rows.find((r) => r.id === id) : undefined;
  if (!row) throw new AdminActionError("That category no longer exists. Please reload the page.");
  return row;
}

function assertNameFree(rows: Row[], name: string, exceptId?: string): void {
  if (rows.some((r) => r.id !== exceptId && r.name.toLowerCase() === name.toLowerCase())) {
    throw new AdminActionError(`There is already a category called “${name}”. Names must be different, even in different groups.`);
  }
}

/** A group can hold categories only if no items sit directly in it. */
function assertCanHoldCategories(rows: Row[], parent: Row): void {
  if (parent.parentId) throw new AdminActionError("Categories can only go inside a top-level group.");
  if (parent.itemCount > 0) {
    throw new AdminActionError(`“${parent.name}” has items directly in it, so it cannot contain other categories. Move its items first.`);
  }
}

export async function createCategory(admin: AdminUser, input: { name: string; parentId: string | null }): Promise<string> {
  const rows = await allRows();
  const name = cleanName(input.name);
  assertNameFree(rows, name);
  const parent = input.parentId ? find(rows, input.parentId) : null;
  if (parent) assertCanHoldCategories(rows, parent);

  const base = slugify(name) || "category";
  let slug = base;
  for (let n = 2; rows.some((r) => r.slug === slug); n++) slug = `${base}-${n}`;
  const siblings = rows.filter((r) => r.parentId === (parent?.id ?? null));
  const [created] = await getDb()
    .insert(categories)
    .values({ name, slug, parentId: parent?.id ?? null, sortOrder: Math.max(-1, ...siblings.map((s) => s.sortOrder)) + 1 })
    .returning({ id: categories.id });
  await recordAudit({
    adminUserId: admin.id,
    action: "category.create",
    entityType: "category",
    entityId: created.id,
    summary: parent ? `Category “${name}” added to ${parent.name}` : `Category group “${name}” added`,
  });
  return created.id;
}

/** The web address (slug) deliberately stays the same, so existing links keep working. */
export async function renameCategory(admin: AdminUser, id: string, newName: string): Promise<void> {
  const rows = await allRows();
  const row = find(rows, id);
  const name = cleanName(newName);
  if (name === row.name) return;
  assertNameFree(rows, name, id);
  await getDb().update(categories).set({ name }).where(eq(categories.id, id));
  await recordAudit({ adminUserId: admin.id, action: "category.rename", entityType: "category", entityId: id, summary: `Category “${row.name}” renamed to “${name}”` });
}

/** Hidden categories, and every item in them, disappear from the website and from the assistant. */
export async function setCategoryActive(admin: AdminUser, id: string, isActive: boolean): Promise<void> {
  const row = find(await allRows(), id);
  if (row.isActive === isActive) return;
  await getDb().update(categories).set({ isActive }).where(eq(categories.id, id));
  await recordAudit({
    adminUserId: admin.id,
    action: isActive ? "category.show" : "category.hide",
    entityType: "category",
    entityId: id,
    summary: `Category “${row.name}” ${isActive ? "shown on" : "hidden from"} the website`,
  });
}

export async function moveCategory(admin: AdminUser, id: string, direction: "up" | "down"): Promise<void> {
  const rows = await allRows();
  const row = find(rows, id);
  const siblings = rows.filter((r) => r.parentId === row.parentId);
  const index = siblings.findIndex((s) => s.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= siblings.length) return;
  [siblings[index], siblings[target]] = [siblings[target], siblings[index]];
  await getDb().transaction(async (tx) => {
    for (const [order, sibling] of siblings.entries()) {
      if (sibling.sortOrder !== order) await tx.update(categories).set({ sortOrder: order }).where(eq(categories.id, sibling.id));
    }
  });
  await recordAudit({ adminUserId: admin.id, action: "category.reorder", entityType: "category", entityId: id, summary: `Category “${row.name}” moved ${direction}` });
}

/** Move a category into another group, or out to the top level (parentId null). */
export async function setCategoryParent(admin: AdminUser, id: string, parentId: string | null): Promise<void> {
  const rows = await allRows();
  const row = find(rows, id);
  if ((row.parentId ?? null) === parentId) return;
  if (rows.some((r) => r.parentId === id)) throw new AdminActionError(`“${row.name}” contains other categories, so it cannot be moved inside a group.`);
  const parent = parentId ? find(rows, parentId) : null;
  if (parent) {
    if (parent.id === id) throw new AdminActionError("A category cannot go inside itself.");
    assertCanHoldCategories(rows, parent);
  }
  const siblings = rows.filter((r) => r.parentId === parentId);
  await getDb()
    .update(categories)
    .set({ parentId, sortOrder: Math.max(-1, ...siblings.map((s) => s.sortOrder)) + 1 })
    .where(eq(categories.id, id));
  await recordAudit({
    adminUserId: admin.id,
    action: "category.move",
    entityType: "category",
    entityId: id,
    summary: parent ? `Category “${row.name}” moved to ${parent.name}` : `Category “${row.name}” moved to the top level`,
  });
}

/** Top-level categories that may contain others: those with no items directly in them. */
export async function listGroupOptions(): Promise<{ id: string; name: string }[]> {
  const rows = await getDb()
    .select({ id: categories.id, name: categories.name, itemCount: sql<number>`count(${products.id})::int` })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .where(isNull(categories.parentId))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name));
  return rows.filter((r) => r.itemCount === 0).map(({ id, name }) => ({ id, name }));
}
