import "server-only";
import { type SettingsKey, type SiteSettings } from "@/lib/settings";
import { parseSectionForm, SETTINGS_SECTIONS } from "@/lib/settings-form";
import { getDb } from "@/server/db/client";
import { siteSettings } from "@/server/db/schema";
import { processProductPhoto } from "@/server/images/process";
import { getStorage } from "@/server/storage";
import type { AdminUser } from "./admin-auth";
import { recordAudit } from "./audit";
import { getSettings } from "./settings";

/** ADMIN ONLY: the only code that writes site settings. Callers must have checked requireAdmin(). */

async function store<K extends SettingsKey>(key: K, value: SiteSettings[K]): Promise<void> {
  await getDb()
    .insert(siteSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: new Date() } });
}

export type SaveSettingsResult = { ok: true; changed: string[] } | { ok: false; errors: Record<string, string> };

export async function saveSettingsSection(admin: AdminUser, sectionId: string, raw: Record<string, string>): Promise<SaveSettingsResult> {
  const section = SETTINGS_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return { ok: false, errors: { form: "Unknown settings section." } };
  const parsed = parseSectionForm(section, raw, await getSettings());
  if (!parsed.ok) return parsed;
  if (parsed.changed.length === 0) return { ok: true, changed: [] };
  await store(section.key, parsed.value);
  await recordAudit({
    adminUserId: admin.id,
    action: "settings.update",
    entityType: "settings",
    entityId: section.key,
    summary: `Settings changed: ${section.title} (${parsed.changed.join(", ")})`,
  });
  return { ok: true, changed: parsed.changed };
}

/** Replaces the large homepage picture. The file is checked and re-encoded like a product photo. */
export async function setHeroImage(admin: AdminUser, file: Buffer): Promise<void> {
  const photo = await processProductPhoto(file);
  const key = `site/hero-${photo.fingerprint}.webp`;
  const storage = getStorage();
  await storage.put(key, photo.data, "image/webp");
  const { homepage } = await getSettings();
  await store("homepage", { ...homepage, heroImageKey: key });
  // Remove the previous upload, but never the sample picture that sample data points at.
  if (homepage.heroImageKey && homepage.heroImageKey !== key && homepage.heroImageKey.startsWith("site/")) {
    await storage.delete(homepage.heroImageKey);
  }
  await recordAudit({ adminUserId: admin.id, action: "settings.update", entityType: "settings", entityId: "homepage", summary: "Homepage picture replaced" });
}
