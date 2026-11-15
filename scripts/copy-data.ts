/**
 * Copies the whole shop (items, photos' records, categories, settings, shop
 * information, conversations, history and the administrator account) from
 * one database to another: normally from your computer to the live database.
 *
 *   npm run data:copy
 *
 * Reads from DATABASE_URL and writes to TARGET_DATABASE_URL (both in
 * .env.local). The source is only read, never changed. The target must be
 * empty of items; the copy either completes fully or changes nothing.
 * Photos themselves are copied separately with "npm run storage:upload".
 */
import postgres from "postgres";
import { connectionOptions, databaseAddressProblem, describeDatabase } from "@/server/db/connection";
import { connectionHint, failWith, prepareEmptyTarget, readShop, reason, verifyShop, writeShop } from "./lib/shop-data";

async function main() {
  const sourceUrl = process.env.DATABASE_URL;
  const targetUrl = process.env.TARGET_DATABASE_URL;
  if (!sourceUrl) throw new Error("DATABASE_URL (where to copy from) is not set in .env.local.");
  if (!targetUrl) throw new Error("TARGET_DATABASE_URL (where to copy to) is not set in .env.local.");
  const problem = databaseAddressProblem(targetUrl);
  if (problem) throw new Error(`TARGET_DATABASE_URL in .env.local is not right. ${problem}`);
  if (describeDatabase(sourceUrl) === describeDatabase(targetUrl)) throw new Error("The source and the target are the same database.");

  console.log(`From: ${describeDatabase(sourceUrl)}`);
  console.log(`To:   ${describeDatabase(targetUrl)}\n`);

  const source = postgres(sourceUrl, { max: 1, ...connectionOptions(sourceUrl) });
  const target = postgres(targetUrl, { max: 1, ...connectionOptions(targetUrl) });
  try {
    await source`select 1`.catch((error) => {
      throw new Error(`Could not connect to the database being copied from (${reason(error)}). Is it running?`);
    });
    await target`select 1`.catch((error) => {
      throw new Error(`Could not connect to the database being copied to (${reason(error)}).${connectionHint(error)}`);
    });

    await prepareEmptyTarget(target);
    console.log("Tables are ready in the target.");

    const data = await readShop(source);
    await writeShop(target, data);

    console.log("\nCopied:");
    if (!(await verifyShop(target, data))) throw new Error("The copy does not match the source. Please send this output to your developer.");
    console.log("\nEverything was copied and matches.");
    console.log("You can sign in to the live shop with the same email and password as on this computer.");
  } finally {
    await source.end({ timeout: 5 });
    await target.end({ timeout: 5 });
  }
}

main().catch(failWith);
