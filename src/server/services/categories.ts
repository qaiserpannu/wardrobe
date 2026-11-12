import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { categories, products } from "@/server/db/schema";
import type { PublicCategory } from "./types";

/** Active categories in display order, with how many items are currently available in each. */
export async function listCategories(): Promise<PublicCategory[]> {
  return getDb()
    .select({
      name: categories.name,
      slug: categories.slug,
      availableCount: sql<number>`count(${products.id}) filter (where ${products.status} = 'available')::int`,
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .where(eq(categories.isActive, true))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}
