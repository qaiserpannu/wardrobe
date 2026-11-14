/**
 * Tools for cloud photo storage.
 *
 *   npm run storage:check    saves a tiny test picture, reads it back, removes it
 *   npm run storage:upload   copies every photo from the local "storage" folder to cloud storage
 *
 * Both use the storage settings in .env.local (STORAGE_DRIVER=supabase,
 * SUPABASE_URL, SUPABASE_SECRET_KEY). Uploading is safe to run again: files
 * already there are simply written again with the same contents.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

async function check() {
  const { getStorage, storageDriverName } = await import("@/server/storage");
  const sharp = (await import("sharp")).default;
  const driver = storageDriverName();
  console.log(`Storage in use: ${driver}`);
  if (driver !== "supabase") {
    console.log('This is the local folder. To test cloud storage, set STORAGE_DRIVER=supabase in .env.local.');
  }
  const storage = getStorage();
  const key = `checks/storage-check-${Date.now()}.webp`;
  const picture = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#7a1e2c" } }).webp().toBuffer();

  await storage.put(key, picture, "image/webp");
  console.log("1. Saved a test picture.");
  const back = await storage.read(key);
  if (!back || !back.data.equals(picture)) throw new Error("The picture read back is not the one that was saved.");
  console.log("2. Read it back unchanged.");
  await storage.delete(key);
  if ((await storage.read(key)) !== null) throw new Error("The picture is still there after removing it.");
  console.log("3. Removed it again.");
  console.log("\nPhoto storage works.");
}

async function walk(dir: string, base = dir): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full, base)));
    else files.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return files;
}

async function upload() {
  const { getStorage, storageDriverName } = await import("@/server/storage");
  const { contentTypeFor, isValidStorageKey } = await import("@/server/storage/keys");
  if (storageDriverName() !== "supabase") {
    throw new Error("Set STORAGE_DRIVER=supabase (with SUPABASE_URL and SUPABASE_SECRET_KEY) in .env.local first, so there is somewhere to upload to.");
  }
  const root = path.resolve(process.env.STORAGE_LOCAL_DIR ?? "./storage");
  // Test pictures and one-off checks are not part of the shop.
  const keys = (await walk(root)).filter((k) => isValidStorageKey(k) && !k.startsWith("test/") && !k.startsWith("checks/"));
  if (keys.length === 0) {
    console.log(`No photos found in ${root}.`);
    return;
  }
  const storage = getStorage();
  let done = 0;
  const failed: string[] = [];
  for (const key of keys) {
    try {
      await storage.put(key, await readFile(path.join(root, key)), contentTypeFor(key));
      done += 1;
      if (done % 20 === 0) console.log(`${done} of ${keys.length}…`);
    } catch (error) {
      failed.push(`${key}: ${error instanceof Error ? error.message : error}`);
    }
  }
  console.log(`\nUploaded ${done} of ${keys.length} photos.`);
  if (failed.length) {
    console.log(`\n${failed.length} could not be uploaded:`);
    for (const line of failed.slice(0, 20)) console.log(`  ${line}`);
    process.exitCode = 1;
  }
}

const command = process.argv[2];
const task = command === "check" ? check : command === "upload" ? upload : null;
if (!task) {
  console.error('Use "check" or "upload".');
  process.exit(1);
}
task().catch((error) => {
  console.error(`\nCould not finish: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
