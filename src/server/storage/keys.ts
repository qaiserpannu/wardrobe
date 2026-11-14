import path from "node:path";

/** Rules for stored file names, shared by every storage provider. */

const KEY_PATTERN = /^[a-z0-9][a-z0-9/_-]*\.(webp|jpg|jpeg|png|avif)$/;

export const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".avif": "image/avif",
};

/** Only simple lowercase keys with an image extension are accepted - no "..", no absolute paths. */
export function isValidStorageKey(key: string): boolean {
  return KEY_PATTERN.test(key) && !key.includes("//") && key.length <= 200;
}

export function assertValidStorageKey(key: string): void {
  if (!isValidStorageKey(key)) throw new Error(`Invalid storage key: ${key}`);
}

export function contentTypeFor(key: string): string {
  return CONTENT_TYPES[path.extname(key)] ?? "application/octet-stream";
}
