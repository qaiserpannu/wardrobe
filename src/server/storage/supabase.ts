import "server-only";
import type { StorageDriver, StoredFile } from "./index";
import { assertValidStorageKey, contentTypeFor, isValidStorageKey } from "./keys";

/**
 * Stores files in a Supabase Storage bucket, over its plain web API (no extra
 * library). The bucket stays PRIVATE: browsers never talk to Supabase.
 * Photos are still served from this site's own /media address, which reads
 * them from the bucket with the server's key.
 *
 * Needs, on the server only:
 *   SUPABASE_URL             e.g. https://abcdefgh.supabase.co
 *   SUPABASE_SECRET_KEY      the project's secret (service) key - never a public key
 *   SUPABASE_STORAGE_BUCKET  optional, default "media"
 */

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "media";
  if (!url || !key) {
    throw new Error("Photo storage is not configured: set SUPABASE_URL and SUPABASE_SECRET_KEY.");
  }
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(url)) throw new Error("SUPABASE_URL must look like https://your-project.supabase.co");
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(bucket)) throw new Error("SUPABASE_STORAGE_BUCKET may only contain lower-case letters, digits, - and _.");
  return { key, objectUrl: (objectKey: string) => `${url}/storage/v1/object/${bucket}/${objectKey}` };
}

const auth = (key: string) => ({ Authorization: `Bearer ${key}`, apikey: key });

async function problem(action: string, response: Response): Promise<Error> {
  const detail = (await response.text().catch(() => "")).slice(0, 200);
  return new Error(`Photo storage could not ${action} (${response.status}). ${detail}`);
}

export const supabaseStorageDriver: StorageDriver = {
  async put(key, data, contentType) {
    assertValidStorageKey(key);
    const { key: secret, objectUrl } = config();
    const response = await fetch(objectUrl(key), {
      method: "POST",
      headers: { ...auth(secret), "Content-Type": contentType, "x-upsert": "true", "cache-control": "31536000" },
      body: new Uint8Array(data),
    });
    if (!response.ok) throw await problem("save the file", response);
  },

  async delete(key) {
    assertValidStorageKey(key);
    const { key: secret, objectUrl } = config();
    const response = await fetch(objectUrl(key), { method: "DELETE", headers: auth(secret) });
    // Already gone counts as deleted.
    if (!response.ok && response.status !== 404 && response.status !== 400) throw await problem("remove the file", response);
  },

  async read(key): Promise<StoredFile | null> {
    if (!isValidStorageKey(key)) return null;
    const { key: secret, objectUrl } = config();
    const response = await fetch(objectUrl(key), { headers: auth(secret), cache: "no-store" });
    if (response.status === 404 || response.status === 400) return null;
    if (!response.ok) throw await problem("read the file", response);
    return { data: Buffer.from(await response.arrayBuffer()), contentType: contentTypeFor(key) };
  },

  publicUrl(key) {
    return `/media/${key}`;
  },
};
