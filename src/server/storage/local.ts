import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageDriver } from "./index";

const KEY_PATTERN = /^[a-z0-9][a-z0-9/_-]*\.(webp|jpg|jpeg|png|avif)$/;

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".avif": "image/avif",
};

function rootDir() {
  return path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_LOCAL_DIR ?? "./storage");
}

/** Only simple lowercase keys with an image extension are accepted - no "..", no absolute paths. */
export function isValidStorageKey(key: string): boolean {
  return KEY_PATTERN.test(key) && !key.includes("//") && key.length <= 200;
}

function resolveKey(key: string): string {
  if (!isValidStorageKey(key)) throw new Error(`Invalid storage key: ${key}`);
  return path.join(rootDir(), key);
}

export async function readLocalFile(key: string): Promise<{ data: Buffer; contentType: string } | null> {
  if (!isValidStorageKey(key)) return null;
  try {
    const data = await readFile(resolveKey(key));
    return { data, contentType: CONTENT_TYPES[path.extname(key)] ?? "application/octet-stream" };
  } catch {
    return null;
  }
}

/** Removes one top-level folder of stored files. Used when reloading sample data. */
export async function clearLocalFolder(folder: string): Promise<void> {
  if (!/^[a-z0-9_-]+$/.test(folder)) throw new Error(`Invalid folder: ${folder}`);
  await rm(path.join(rootDir(), folder), { recursive: true, force: true });
}

/** Stores files in a local folder. For development and tests only. */
export const localStorageDriver: StorageDriver = {
  async put(key, data) {
    const file = resolveKey(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
  },
  async delete(key) {
    await rm(resolveKey(key), { force: true });
  },
  publicUrl(key) {
    return `/media/${key}`;
  },
};
