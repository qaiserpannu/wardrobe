"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/server/auth/session";
import type { AdminUser } from "@/server/services/admin-auth";
import { handBackToAssistant, markDealtWith, replyAsOwner } from "@/server/services/admin-inbox";
import { AdminActionError } from "@/server/services/admin-products";

export type InboxState = { error?: string; success?: string; values?: { message: string } };

async function run(task: (admin: AdminUser) => Promise<void>, success: string): Promise<InboxState> {
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

const str = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");

export async function replyAction(_previous: InboxState, formData: FormData): Promise<InboxState> {
  const message = str(formData.get("message")).slice(0, 5000);
  const result = await run((admin) => replyAsOwner(admin, str(formData.get("id")), message), "Sent. The customer sees it in the chat on the website.");
  return result.error ? { ...result, values: { message } } : result;
}

export async function handBackAction(_previous: InboxState, formData: FormData): Promise<InboxState> {
  return run((admin) => handBackToAssistant(admin, str(formData.get("id"))), "The assistant will answer this customer again.");
}

export async function dealtWithAction(_previous: InboxState, formData: FormData): Promise<InboxState> {
  return run((admin) => markDealtWith(admin, str(formData.get("id"))), "Marked as dealt with.");
}
