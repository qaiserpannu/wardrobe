import "server-only";
import { localStorageDriver } from "./local";
import { supabaseStorageDriver } from "./supabase";

/**
 * Image storage. The database stores a "key" (e.g. "products/plw-0001/ab12.webp"),
 * never a full URL, so the storage provider can change without touching data.
 * Whatever the provider, photos are served from this site's own /media address.
 */
export type StoredFile = { data: Buffer; contentType: string };

export interface StorageDriver {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  /** The file, or null if there is none under that key. */
  read(key: string): Promise<StoredFile | null>;
  /** URL the browser can load the file from. */
  publicUrl(key: string): string;
}

export type StorageDriverName = "local" | "supabase";

export function storageDriverName(): StorageDriverName {
  const driver = (process.env.STORAGE_DRIVER || "local").trim().toLowerCase();
  if (driver === "local" || driver === "supabase") return driver;
  throw new Error(`Unknown STORAGE_DRIVER "${driver}". Use "local" or "supabase".`);
}

export function getStorage(): StorageDriver {
  return storageDriverName() === "supabase" ? supabaseStorageDriver : localStorageDriver;
}
