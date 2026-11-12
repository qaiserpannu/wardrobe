import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { listCategories } from "./categories";
import { getSettings } from "./settings";

/**
 * Settings and the category list appear on every page and change rarely, so
 * they are cached briefly. Product data is never cached: availability must
 * always be current.
 *
 * The admin portal (Milestone 5) will clear these tags when it saves, so edits
 * show up immediately. Until then a change made directly in the database
 * appears within a minute.
 */
export const CACHE_TAGS = { settings: "settings", categories: "categories" } as const;

export async function getCachedSettings() {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });
  cacheTag(CACHE_TAGS.settings);
  return getSettings();
}

export async function getCachedCategories() {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });
  cacheTag(CACHE_TAGS.categories);
  return listCategories();
}
