"use server";

import { refresh, updateTag } from "next/cache";
import { requireAdmin } from "@/server/auth/session";
import { saveSettingsSection } from "@/server/services/admin-settings";
import { CACHE_TAGS } from "@/server/services/cached";

export type SettingsState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
  /** What was typed, so a failed save does not clear the form. */
  values?: Record<string, string>;
};

export async function saveSettingsAction(_previous: SettingsState, formData: FormData): Promise<SettingsState> {
  const admin = await requireAdmin();
  const raw: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$")) raw[key] = value.slice(0, 5000);
  }
  const result = await saveSettingsSection(admin, raw.section ?? "", raw);
  if (!result.ok) return { error: "Please check the highlighted boxes.", fieldErrors: result.errors, values: raw };
  updateTag(CACHE_TAGS.settings);
  refresh();
  return { success: result.changed.length > 0 ? "Saved. The website is updated." : "Nothing to change." };
}
