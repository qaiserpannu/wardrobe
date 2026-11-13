import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { aiKnowledge } from "@/server/db/schema";

export type KnowledgeEntry = { kind: "faq" | "policy"; title: string; content: string };

/** Approved business information the AI assistant may quote. */
export async function listActiveKnowledge(): Promise<KnowledgeEntry[]> {
  return getDb()
    .select({ kind: aiKnowledge.kind, title: aiKnowledge.title, content: aiKnowledge.content })
    .from(aiKnowledge)
    .where(eq(aiKnowledge.isActive, true))
    .orderBy(asc(aiKnowledge.sortOrder), asc(aiKnowledge.title));
}
