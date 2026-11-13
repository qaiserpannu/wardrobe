import "server-only";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { aiKnowledge } from "@/server/db/schema";
import type { AdminUser } from "./admin-auth";
import { AdminActionError } from "./admin-products";
import { recordAudit } from "./audit";

/**
 * ADMIN ONLY: the approved shop information the assistant may quote (pickup,
 * payment, returns, common questions). The assistant states nothing about the
 * business that is not in here or in the inventory.
 */

export type KnowledgeItem = { id: string; kind: "faq" | "policy"; title: string; content: string; isActive: boolean };

export const knowledgeInputSchema = z.object({
  kind: z.enum(["faq", "policy"]),
  title: z.string().trim().min(2, "Give it a short title.").max(100),
  content: z.string().trim().min(2, "Write the information.").max(2000),
});
export type KnowledgeInput = z.infer<typeof knowledgeInputSchema>;

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listKnowledge(): Promise<KnowledgeItem[]> {
  return getDb()
    .select({ id: aiKnowledge.id, kind: aiKnowledge.kind, title: aiKnowledge.title, content: aiKnowledge.content, isActive: aiKnowledge.isActive })
    .from(aiKnowledge)
    .orderBy(asc(aiKnowledge.sortOrder), asc(aiKnowledge.title));
}

async function find(id: string) {
  const [row] = ID_PATTERN.test(id) ? await getDb().select().from(aiKnowledge).where(eq(aiKnowledge.id, id)) : [];
  if (!row) throw new AdminActionError("That entry no longer exists. Please reload the page.");
  return row;
}

export async function createKnowledge(admin: AdminUser, input: KnowledgeInput): Promise<string> {
  const all = await listKnowledge();
  const [created] = await getDb()
    .insert(aiKnowledge)
    .values({ ...input, sortOrder: all.length })
    .returning({ id: aiKnowledge.id });
  await recordAudit({ adminUserId: admin.id, action: "knowledge.create", entityType: "knowledge", entityId: created.id, summary: `Shop information added: ${input.title}` });
  return created.id;
}

export async function updateKnowledge(admin: AdminUser, id: string, input: KnowledgeInput): Promise<void> {
  const before = await find(id);
  if (before.kind === input.kind && before.title === input.title && before.content === input.content) return;
  await getDb().update(aiKnowledge).set(input).where(eq(aiKnowledge.id, id));
  await recordAudit({
    adminUserId: admin.id,
    action: "knowledge.update",
    entityType: "knowledge",
    entityId: id,
    summary: `Shop information changed: ${input.title}`,
    details: { before: { title: before.title, content: before.content }, after: { title: input.title, content: input.content } },
  });
}

/** An entry that is switched off is kept but the assistant no longer uses it. */
export async function setKnowledgeActive(admin: AdminUser, id: string, isActive: boolean): Promise<void> {
  const row = await find(id);
  if (row.isActive === isActive) return;
  await getDb().update(aiKnowledge).set({ isActive }).where(eq(aiKnowledge.id, id));
  await recordAudit({
    adminUserId: admin.id,
    action: isActive ? "knowledge.on" : "knowledge.off",
    entityType: "knowledge",
    entityId: id,
    summary: `Shop information switched ${isActive ? "on" : "off"}: ${row.title}`,
  });
}

export async function deleteKnowledge(admin: AdminUser, id: string): Promise<void> {
  const row = await find(id);
  await getDb().delete(aiKnowledge).where(eq(aiKnowledge.id, id));
  await recordAudit({
    adminUserId: admin.id,
    action: "knowledge.delete",
    entityType: "knowledge",
    entityId: id,
    summary: `Shop information deleted: ${row.title}`,
    details: { title: row.title, content: row.content },
  });
}
