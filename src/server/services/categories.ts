import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { categories, products } from "@/server/db/schema";
import type { PublicCategory, PublicCategoryGroup } from "./types";

/**
 * Active categories as a two-level tree in display order: groups (Women, Men...)
 * with the categories inside them, each with how many items are available.
 * Categories inside a switched-off group are left out.
 */
export async function listCategoryTree(): Promise<PublicCategoryGroup[]> {
  const rows = await getDb()
    .select({
      id: categories.id,
      parentId: categories.parentId,
      name: categories.name,
      slug: categories.slug,
      availableCount: sql<number>`count(${products.id}) filter (where ${products.status} = 'available')::int`,
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .where(eq(categories.isActive, true))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  const groups = new Map<string, PublicCategoryGroup>();
  for (const r of rows) {
    if (!r.parentId) groups.set(r.id, { name: r.name, slug: r.slug, availableCount: r.availableCount, children: [] });
  }
  for (const r of rows) {
    const group = r.parentId ? groups.get(r.parentId) : undefined;
    if (!group) continue;
    group.children.push({ name: r.name, slug: r.slug, availableCount: r.availableCount });
    group.availableCount += r.availableCount;
  }
  return [...groups.values()];
}

/** Look up a group or category by its address name anywhere in the tree. */
export function findCategory(tree: PublicCategoryGroup[], slug: string | null): PublicCategory | null {
  if (!slug) return null;
  for (const group of tree) {
    if (group.slug === slug) return group;
    const child = group.children.find((c) => c.slug === slug);
    if (child) return child;
  }
  return null;
}
