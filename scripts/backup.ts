/**
 * Backups of the whole shop, kept on your own computer.
 *
 *   npm run backup           saves the database and every photo into ./backups/<date>/
 *   npm run backup:check     proves the newest backup can be restored (into a throwaway
 *                            database on this computer, which is removed again)
 *   npm run backup:restore   puts the newest backup into an EMPTY database and storage
 *                            (TARGET_DATABASE_URL), for when the live one is lost
 *
 * The backup folder holds customer conversations and the (scrambled) admin
 * password, so keep it private. It is never uploaded to GitHub.
 */
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { connectionOptions, databaseAddressProblem, describeDatabase, isLocalDatabase } from "@/server/db/connection";
import { connectionHint, failWith, prepareEmptyTarget, readShop, reason, TABLES, verifyShop, writeShop, type ShopData } from "./lib/shop-data";

const ROOT = path.resolve(process.env.BACKUP_DIR ?? "./backups");
const CHECK_DATABASE = "wardrobe_backup_check";

interface BackupFile {
  format: 1;
  takenAt: string;
  from: string;
  photos: string[];
  data: ShopData;
}

function photoKeys(data: ShopData): string[] {
  const keys = new Set<string>();
  for (const row of data.tables.product_images.rows as { storage_key?: string }[]) {
    if (row.storage_key) keys.add(row.storage_key);
  }
  for (const row of data.tables.site_settings.rows as { value?: Record<string, unknown> }[]) {
    for (const name of ["heroImageKey", "logoKey"]) {
      const key = row.value?.[name];
      if (typeof key === "string" && key) keys.add(key);
    }
  }
  return [...keys].sort();
}

async function latestBackup(): Promise<{ dir: string; file: BackupFile }> {
  const names = (await readdir(ROOT).catch(() => [])).filter((n) => /^\d{4}-\d{2}-\d{2}_\d{4}$/.test(n)).sort();
  const name = names.at(-1);
  if (!name) throw new Error(`No backup found in ${ROOT}. Run "npm run backup" first.`);
  const dir = path.join(ROOT, name);
  const file = JSON.parse(await readFile(path.join(dir, "shop.json"), "utf8")) as BackupFile;
  if (file.format !== 1 || !file.data?.tables) throw new Error(`The backup in ${dir} cannot be read.`);
  return { dir, file };
}

async function backup() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set in .env.local.");
  const { getStorage, storageDriverName } = await import("@/server/storage");
  const { isValidStorageKey } = await import("@/server/storage/keys");
  console.log(`Database: ${describeDatabase(url)}`);
  console.log(`Photos:   ${storageDriverName()} storage\n`);

  const sql = postgres(url, { max: 1, ...connectionOptions(url) });
  let data: ShopData;
  try {
    await sql`select 1`.catch((error) => {
      throw new Error(`Could not connect to the database (${reason(error)}).${connectionHint(error)}`);
    });
    data = await readShop(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }

  const now = new Date();
  const stamp = `${now.toISOString().slice(0, 10)}_${now.toISOString().slice(11, 16).replace(":", "")}`;
  const dir = path.join(ROOT, stamp);
  await mkdir(dir, { recursive: true });

  const keys = photoKeys(data).filter(isValidStorageKey);
  const storage = getStorage();
  const missing: string[] = [];
  let saved = 0;
  for (const key of keys) {
    const file = await storage.read(key).catch(() => null);
    if (!file) {
      missing.push(key);
      continue;
    }
    const target = path.join(dir, "photos", ...key.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.data);
    saved += 1;
    if (saved % 25 === 0) console.log(`${saved} of ${keys.length} photos…`);
  }

  const file: BackupFile = { format: 1, takenAt: now.toISOString(), from: describeDatabase(url), photos: keys.filter((k) => !missing.includes(k)), data };
  await writeFile(path.join(dir, "shop.json"), JSON.stringify(file));

  console.log("Saved:");
  for (const table of TABLES) console.log(`  ${table.padEnd(24)} ${String(data.tables[table].rows.length).padStart(6)}`);
  console.log(`  ${"photos".padEnd(24)} ${String(saved).padStart(6)}${missing.length ? `   (${missing.length} could not be read)` : ""}`);
  for (const key of missing.slice(0, 10)) console.log(`    missing: ${key}`);
  console.log(`\nBackup saved in ${dir}`);
  console.log('Now run "npm run backup:check" to prove it can be restored.');
  console.log("Keep this folder private, and copy it somewhere off this computer now and then.");
  if (missing.length) process.exitCode = 1;
}

async function checkPhotos(dir: string, file: BackupFile): Promise<number> {
  let bad = 0;
  for (const key of file.photos) {
    const info = await stat(path.join(dir, "photos", ...key.split("/"))).catch(() => null);
    if (!info || info.size === 0) bad += 1;
  }
  return bad;
}

async function check() {
  const { dir, file } = await latestBackup();
  console.log(`Checking the backup taken ${file.takenAt.slice(0, 16).replace("T", " ")} UTC\n(${dir})\n`);

  // A throwaway database on this computer; the live shop is not touched.
  const serverUrl = process.env.BACKUP_CHECK_DATABASE_URL ?? "postgres://wardrobe:wardrobe@localhost:5432/wardrobe";
  if (!isLocalDatabase(serverUrl)) throw new Error("BACKUP_CHECK_DATABASE_URL must be a database on this computer.");
  const server = postgres(serverUrl, { max: 1, onnotice: () => {} });
  const scratchUrl = new URL(serverUrl);
  scratchUrl.pathname = `/${CHECK_DATABASE}`;
  try {
    await server`select 1`.catch((error) => {
      throw new Error(
        `The practice restore needs the database on this computer, and it could not be reached (${reason(error)}). Start it (Docker Desktop, then "docker compose up -d") and try again.`,
      );
    });
    await server.unsafe(`drop database if exists ${CHECK_DATABASE}`);
    await server.unsafe(`create database ${CHECK_DATABASE}`);
    const scratch = postgres(scratchUrl.toString(), { max: 1, onnotice: () => {} });
    let ok: boolean;
    try {
      await prepareEmptyTarget(scratch);
      await writeShop(scratch, file.data);
      console.log("Restored into a practice database:");
      ok = await verifyShop(scratch, file.data);
    } finally {
      await scratch.end({ timeout: 5 });
      await server.unsafe(`drop database if exists ${CHECK_DATABASE}`);
    }
    const badPhotos = await checkPhotos(dir, file);
    console.log(`  ${"photos".padEnd(24)} ${String(file.photos.length - badPhotos).padStart(6)}${badPhotos ? `   <- ${badPhotos} missing or empty` : ""}`);
    if (!ok || badPhotos) throw new Error("The restored copy does not match the backup. Please send this output to your developer.");
    console.log("\nThe backup restores completely and matches. The practice database was removed again.");
  } finally {
    await server.end({ timeout: 5 });
  }
}

async function restore() {
  const { dir, file } = await latestBackup();
  const targetUrl = process.env.TARGET_DATABASE_URL;
  if (!targetUrl) throw new Error("TARGET_DATABASE_URL (the empty database to restore into) is not set in .env.local.");
  const problem = databaseAddressProblem(targetUrl);
  if (problem) throw new Error(`TARGET_DATABASE_URL in .env.local is not right. ${problem}`);
  const { getStorage, storageDriverName } = await import("@/server/storage");
  const { contentTypeFor } = await import("@/server/storage/keys");
  console.log(`Restoring the backup taken ${file.takenAt.slice(0, 16).replace("T", " ")} UTC`);
  console.log(`Into:   ${describeDatabase(targetUrl)}`);
  console.log(`Photos: ${storageDriverName()} storage\n`);

  const target = postgres(targetUrl, { max: 1, ...connectionOptions(targetUrl) });
  try {
    await target`select 1`.catch((error) => {
      throw new Error(`Could not connect to the database (${reason(error)}).${connectionHint(error)}`);
    });
    await prepareEmptyTarget(target);
    await writeShop(target, file.data);
    console.log("Restored:");
    if (!(await verifyShop(target, file.data))) throw new Error("The restored database does not match the backup.");
  } finally {
    await target.end({ timeout: 5 });
  }
  const storage = getStorage();
  let done = 0;
  for (const key of file.photos) {
    await storage.put(key, await readFile(path.join(dir, "photos", ...key.split("/"))), contentTypeFor(key));
    done += 1;
  }
  console.log(`  ${"photos".padEnd(24)} ${String(done).padStart(6)}`);
  console.log("\nThe shop was restored from the backup.");
}

const command = process.argv[2];
const run = command === "check" ? check : command === "restore" ? restore : command === "save" ? backup : null;
if (!run) {
  console.error("Use: npm run backup | npm run backup:check | npm run backup:restore");
  process.exit(1);
}
run().catch(failWith);
