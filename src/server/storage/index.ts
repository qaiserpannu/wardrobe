import "server-only";
import { localStorageDriver } from "./local";

/**
 * Image storage. The database stores a "key" (e.g. "products/plw-0001-1.webp"),
 * never a full URL, so the storage provider can change without touching data.
 */
export interface StorageDriver {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  /** URL the browser can load the file from. */
  publicUrl(key: string): string;
}

export function getStorage(): StorageDriver {
  const driver = process.env.STORAGE_DRIVER ?? "local";
  switch (driver) {
    case "local":
      return localStorageDriver;
    default:
      throw new Error(`Unknown STORAGE_DRIVER "${driver}"`);
  }
}
