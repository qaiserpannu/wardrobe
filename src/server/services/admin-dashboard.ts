import "server-only";
import type { ProductStatus } from "@/lib/product-form";
import { desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { categories, conversations, customers, escalations, products } from "@/server/db/schema";

/** Admin only: includes drafts and archived items. Never call from public pages or the agent. */


export async function countProductsByStatus(): Promise<Record<ProductStatus, number>> {
  const rows = await getDb()
    .select({ status: products.status, n: sql<number>`count(*)::int` })
    .from(products)
    .groupBy(products.status);
  const counts: Record<ProductStatus, number> = { draft: 0, available: 0, pending: 0, sold: 0, archived: 0 };
  for (const row of rows) counts[row.status] = row.n;
  return counts;
}

export async function listRecentlyChangedProducts(limit = 6) {
  return getDb()
    .select({
      id: products.id,
      code: products.code,
      name: products.name,
      status: products.status,
      priceCents: products.priceCents,
      category: categories.name,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .orderBy(desc(products.updatedAt), desc(products.code))
    .limit(limit);
}

/** Customer questions and requests still waiting for the owner, newest first. */
export async function listWaitingRequests(limit = 6) {
  return getDb()
    .select({
      id: escalations.id,
      conversationId: escalations.conversationId,
      reason: escalations.reason,
      question: escalations.question,
      createdAt: escalations.createdAt,
      customerName: customers.name,
      channel: conversations.channel,
    })
    .from(escalations)
    .innerJoin(conversations, eq(escalations.conversationId, conversations.id))
    .innerJoin(customers, eq(conversations.customerId, customers.id))
    .where(isNull(escalations.resolvedAt))
    .orderBy(desc(escalations.createdAt))
    .limit(limit);
}

export async function countWaitingRequests(): Promise<number> {
  const [row] = await getDb().select({ n: sql<number>`count(*)::int` }).from(escalations).where(isNull(escalations.resolvedAt));
  return row?.n ?? 0;
}
