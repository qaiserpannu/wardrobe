import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStorage, storageDriverName } from "@/server/storage";
import { isValidStorageKey } from "@/server/storage/keys";
import { supabaseStorageDriver } from "@/server/storage/supabase";

/** Cloud photo storage, with the network replaced by a stand-in bucket held in memory. */

const SECRET = "test-secret-key-not-real";
const bucket = new Map<string, { body: Buffer; type: string }>();
const calls: { method: string; url: string; headers: Record<string, string> }[] = [];

beforeEach(() => {
  bucket.clear();
  calls.length = 0;
  vi.stubEnv("STORAGE_DRIVER", "supabase");
  vi.stubEnv("SUPABASE_URL", "https://example-project.supabase.co/");
  vi.stubEnv("SUPABASE_SECRET_KEY", SECRET);
  vi.stubEnv("SUPABASE_STORAGE_BUCKET", "");
  vi.stubGlobal("fetch", async (input: string | URL, init: RequestInit = {}) => {
    const url = String(input);
    const method = init.method ?? "GET";
    const headers = Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]));
    calls.push({ method, url, headers });
    if (headers.authorization !== `Bearer ${SECRET}`) return new Response("unauthorized", { status: 401 });
    const key = url.split("/storage/v1/object/media/")[1];
    if (key === undefined) return new Response("bad bucket", { status: 400 });
    if (method === "POST") {
      bucket.set(key, { body: Buffer.from(init.body as Uint8Array), type: headers["content-type"] });
      return new Response("{}", { status: 200 });
    }
    if (method === "DELETE") return new Response("{}", { status: bucket.delete(key) ? 200 : 404 });
    const found = bucket.get(key);
    return found ? new Response(new Uint8Array(found.body), { status: 200 }) : new Response("{}", { status: 404 });
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("choosing where photos are stored", () => {
  it("uses the local folder unless told otherwise, and refuses an unknown choice", () => {
    vi.stubEnv("STORAGE_DRIVER", "");
    expect(storageDriverName()).toBe("local");
    vi.stubEnv("STORAGE_DRIVER", "Supabase");
    expect(storageDriverName()).toBe("supabase");
    expect(getStorage()).toBe(supabaseStorageDriver);
    vi.stubEnv("STORAGE_DRIVER", "dropbox");
    expect(() => getStorage()).toThrow(/Unknown STORAGE_DRIVER/);
  });
});

describe("cloud photo storage", () => {
  const key = "products/plw-0001/0123456789abcdef.webp";
  const data = Buffer.from("picture-bytes");

  it("saves, reads back and removes a photo", async () => {
    const storage = getStorage();
    await storage.put(key, data, "image/webp");
    expect(bucket.get(key)).toEqual({ body: data, type: "image/webp" });
    expect(await storage.read(key)).toEqual({ data, contentType: "image/webp" });
    await storage.delete(key);
    expect(await storage.read(key)).toBeNull();
    await storage.delete(key); // already gone is not an error
  });

  it("sends the secret key with every request, to the project's own address only", async () => {
    const storage = getStorage();
    await storage.put(key, data, "image/webp");
    await storage.read(key);
    await storage.delete(key);
    expect(calls.map((c) => c.method)).toEqual(["POST", "GET", "DELETE"]);
    for (const call of calls) {
      expect(call.url).toBe(`https://example-project.supabase.co/storage/v1/object/media/${key}`);
      expect(call.headers.authorization).toBe(`Bearer ${SECRET}`);
    }
  });

  it("gives browsers this site's own address, never the storage provider's or the key", () => {
    const url = getStorage().publicUrl(key);
    expect(url).toBe(`/media/${key}`);
    expect(url).not.toContain("supabase");
  });

  it("refuses file names that could reach outside the bucket", async () => {
    const storage = getStorage();
    for (const bad of ["../secrets.webp", "/etc/passwd", "a/../../b.webp", "photo.svg", "photo.webp?x=1", "UPPER.webp", "a//b.webp", ""]) {
      expect(isValidStorageKey(bad), bad).toBe(false);
      await expect(storage.put(bad, data, "image/webp")).rejects.toThrow(/Invalid storage key/);
      await expect(storage.delete(bad)).rejects.toThrow(/Invalid storage key/);
      expect(await storage.read(bad)).toBeNull();
    }
    expect(calls).toHaveLength(0);
  });

  it("explains what is missing when it has not been set up", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    await expect(getStorage().put(key, data, "image/webp")).rejects.toThrow(/SUPABASE_URL and SUPABASE_SECRET_KEY/);
    vi.stubEnv("SUPABASE_SECRET_KEY", SECRET);
    vi.stubEnv("SUPABASE_URL", "http://not-secure.example");
    await expect(getStorage().put(key, data, "image/webp")).rejects.toThrow(/https/);
  });

  it("reports a refusal from the provider without revealing the key", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "a-wrong-key");
    const error = await getStorage().put(key, data, "image/webp").catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("401");
    expect((error as Error).message).not.toContain("a-wrong-key");
  });

  it("accepts the older name for the key", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", SECRET);
    await getStorage().put(key, data, "image/webp");
    expect(bucket.has(key)).toBe(true);
  });
});
