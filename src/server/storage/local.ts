import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageDriver, StoredFile } from "./index";
import { assertValidStorageKey, contentTypeFor, isValidStorageKey } from "./keys";

function rootDir() {
  return path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_LOCAL_DIR ?? "./storage");
}

function resolveKey(key: string): string {
  assertValidStorageKey(key);
  return path.join(rootDir(), key);
}

async function readLocalFile(key: string): Promise<StoredFile | null> {
  if (!isValidStorageKey(key)) return null;
  try {
    return { data: await readFile(resolveKey(key)), contentType: contentTypeFor(key) };
  } catch {
    return null;
  }
}

/** Removes one top-level folder of stored files. Used when reloading sample data. */
export async function clearLocalFolder(folder: string): Promise<void> {
  if (!/^[a-z0-9_-]+$/.test(folder)) throw new Error(`Invalid folder: ${folder}`);
  await rm(path.join(rootDir(), folder), { recursive: true, force: true });
}

/** Stores files in a local folder. For development and tests; not for hosting that has no permanent disk. */
export const localStorageDriver: StorageDriver = {
  async put(key, data) {
    const file = resolveKey(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
  },
  async delete(key) {
    await rm(resolveKey(key), { force: true });
  },
  read: readLocalFile,
  publicUrl(key) {
    return `/media/${key}`;
  },
};
