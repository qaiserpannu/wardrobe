"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/server/auth/session";
import type { AdminUser } from "@/server/services/admin-auth";
import { createKnowledge, deleteKnowledge, knowledgeInputSchema, setKnowledgeActive, updateKnowledge } from "@/server/services/admin-knowledge";
import { AdminActionError } from "@/server/services/admin-products";

export type KnowledgeState = { error?: string; success?: string; values?: Record<string, string> };

async function run(task: (admin: AdminUser) => Promise<unknown>, success: string): Promise<KnowledgeState> {
  const admin = await requireAdmin();
  try {
    await task(admin);
  } catch (error) {
    if (error instanceof AdminActionError) return { error: error.message };
    throw error;
  }
  refresh();
  return { success };
}

const str = (value: unknown) => (typeof value === "string" ? value.slice(0, 5000) : "");

export async function saveKnowledgeAction(_previous: KnowledgeState, formData: FormData): Promise<KnowledgeState> {
  await requireAdmin();
  const values = { kind: str(formData.get("kind")), title: str(formData.get("title")), content: str(formData.get("content")) };
  const parsed = knowledgeInputSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the entry.", values };
  }
  const id = str(formData.get("id"));
  const result = await run((admin) => (id ? updateKnowledge(admin, id, parsed.data) : createKnowledge(admin, parsed.data)), "Saved. The assistant uses it from the next message.");
  return result.error ? { ...result, values } : result;
}

export async function setKnowledgeActiveAction(id: string, isActive: boolean): Promise<KnowledgeState> {
  return run((admin) => setKnowledgeActive(admin, str(id), isActive === true), "");
}

export async function deleteKnowledgeAction(id: string): Promise<KnowledgeState> {
  return run((admin) => deleteKnowledge(admin, str(id)), "");
}
