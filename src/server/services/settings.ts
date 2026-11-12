import "server-only";
import { parseSettings, type SiteSettings } from "@/lib/settings";
import { getDb } from "@/server/db/client";
import { siteSettings } from "@/server/db/schema";
import { getStorage } from "@/server/storage";

export async function getSettings(): Promise<SiteSettings> {
  const rows = await getDb().select().from(siteSettings);
  return parseSettings(Object.fromEntries(rows.map((r) => [r.key, r.value])));
}

/** Browser-loadable URL for a stored image key, or null. */
export function mediaUrl(key: string | null): string | null {
  return key ? getStorage().publicUrl(key) : null;
}
