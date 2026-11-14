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

/** In an order that satisfies the links between tables. Sessions and sign-in attempts are deliberately not copied. */
const TABLES = [
  "admin_users",
  "categories",
  "products",
  "product_images",
  "site_settings",
  "ai_knowledge",
  "product_holds",
  "product_status_events",
  "customers",
  "conversations",
  "messages",
  "leads",
  "escalations",
  "notifications",
  "audit_log",
] as const;

const CHUNK = 400;

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
    // 0. Make sure we can reach both before starting.
    await source`select 1`.catch((error) => {
      throw new Error(`Could not connect to the database on this computer (${reason(error)}). Is it running?`);
    });
    await target`select 1`.catch((error) => {
      throw new Error(`Could not connect to the live database (${reason(error)}).${hint(error)}`);
    });

    // 1. Give the target the same tables.
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(drizzle(target), { migrationsFolder: "./src/server/db/migrations" });
    console.log("Tables are ready in the target.");

    // 2. Never write over a shop that already has things in it.
    for (const table of ["products", "categories", "admin_users"]) {
      const [{ n }] = await target<{ n: number }[]>`select count(*)::int as n from ${target(table)}`;
      if (n > 0) {
        throw new Error(
          `The target already has ${n} row(s) in "${table}". Nothing was copied. The copy only runs into an empty database, so that it can never overwrite a live shop.`,
        );
      }
    }

    // 3. Copy everything in one all-or-nothing step.
    const counts: Record<string, number> = {};
    await target.begin(async (tx) => {
      // Sample settings or shop information created by an earlier attempt are replaced.
      await tx`truncate table site_settings, ai_knowledge`;
      for (const table of TABLES) {
        const columns = (
          await source<{ column_name: string }[]>`
            select column_name from information_schema.columns
            where table_schema = 'public' and table_name = ${table} and is_generated = 'NEVER'
            order by ordinal_position`
        ).map((c) => c.column_name);
        if (columns.length === 0) throw new Error(`The source has no table "${table}". Run "npm run db:migrate" on it first.`);
        const list = columns.map((c) => `"${c}"`).join(", ");

        const rows = await source.unsafe<{ row: unknown }[]>(`select to_jsonb(t) as row from "${table}" t`);
        counts[table] = rows.length;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = JSON.stringify(rows.slice(i, i + CHUNK).map((r) => r.row));
          await tx.unsafe(`insert into "${table}" (${list}) select ${list} from jsonb_populate_recordset(null::"${table}", $1::jsonb)`, [chunk]);
        }
      }
      // New items continue the numbering (PLW-0034 after PLW-0033), never reusing a number.
      const [sequence] = await source<{ last_value: string; is_called: boolean }[]>`select last_value, is_called from product_code_seq`;
      await tx`select setval('product_code_seq', ${sequence.last_value}::bigint, ${sequence.is_called})`;
    });

    // 4. Check the result against the source.
    let mismatch = false;
    console.log("\nCopied:");
    for (const table of TABLES) {
      const [{ n }] = await target<{ n: number }[]>`select count(*)::int as n from ${target(table)}`;
      const ok = n === counts[table];
      if (!ok) mismatch = true;
      console.log(`  ${table.padEnd(24)} ${String(n).padStart(6)}${ok ? "" : `   <- expected ${counts[table]}`}`);
    }
    if (mismatch) throw new Error("The counts do not match. Please send this output to your developer.");
    console.log("\nEverything was copied and the counts match.");
    console.log("You can sign in to the live shop with the same email and password as on this computer.");
  } finally {
    await source.end({ timeout: 5 });
    await target.end({ timeout: 5 });
  }
}

/** The underlying reason for a failure, which the database library often wraps. Contains no password. */
function reason(error: unknown): string {
  const seen: string[] = [];
  let current: unknown = error;
  while (current instanceof Error && seen.length < 4) {
    const code = (current as { code?: string }).code;
    const text = [code, current.message].filter(Boolean).join(": ");
    if (text && !seen.includes(text)) seen.push(text);
    current = current.cause;
  }
  return seen.join(" <- ") || String(error);
}

function hint(error: unknown): string {
  const text = reason(error);
  if (/28P01|password authentication/i.test(text)) return " The password in TARGET_DATABASE_URL is wrong.";
  if (/ENOTFOUND|EAI_AGAIN/i.test(text)) return ' The server name is wrong or cut short. Copy the "Session pooler" address again.';
  if (/ETIMEDOUT|ECONNREFUSED|ENETUNREACH/i.test(text)) return ' Use the "Session pooler" address, not "Direct connection".';
  if (/Tenant or user not found/i.test(text)) return ' The user name or region is wrong. Copy the "Session pooler" address again.';
  return "";
}

main().catch((error) => {
  const message = error instanceof Error && error.cause ? `${error.message}\n  Reason: ${reason(error.cause)}` : error instanceof Error ? error.message : String(error);
  console.error(`\nCould not finish: ${message}`);
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN/.test(message)) {
    console.error('The database could not be reached. Check the address, and use the "Session pooler" connection string from Supabase.');
  }
  if (/password authentication failed/.test(message)) {
    console.error("The database password in the address is not right.");
  }
  process.exit(1);
});
