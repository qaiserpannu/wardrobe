/**
 * Reading the whole shop out of a database and writing it into an empty one.
 * Shared by "npm run data:copy" and the backup tools.
 */
import type postgres from "postgres";

type Sql = postgres.Sql;

/** In an order that satisfies the links between tables. Sessions and sign-in attempts are deliberately left out. */
export const TABLES = [
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

export interface TableData {
  columns: string[];
  rows: unknown[];
  /** A fingerprint of the contents, to prove a restore is identical and not just the same size. */
  fingerprint: string;
}

export interface ShopData {
  tables: Record<string, TableData>;
  sequence: { lastValue: string; isCalled: boolean };
}

async function fingerprints(tx: Sql, table: string): Promise<string> {
  const [{ hash }] = await tx.unsafe<{ hash: string }[]>(
    `select md5(coalesce(string_agg(r, '' order by r), '')) as hash from (select to_jsonb(t)::text as r from "${table}" t) s`,
  );
  return hash;
}

/** Reads every table in one consistent snapshot. Changes nothing. */
export async function readShop(sql: Sql): Promise<ShopData> {
  return sql.begin("isolation level repeatable read read only", async (tx) => {
    // Dates are written the same way wherever this runs, so fingerprints can be compared.
    await tx`set local time zone 'UTC'`;
    const tables: Record<string, TableData> = {};
    for (const table of TABLES) {
      const columns = (
        await tx<{ column_name: string }[]>`
          select column_name from information_schema.columns
          where table_schema = 'public' and table_name = ${table} and is_generated = 'NEVER'
          order by ordinal_position`
      ).map((c) => c.column_name);
      if (columns.length === 0) throw new Error(`There is no table "${table}". Run "npm run db:migrate" on that database first.`);
      const rows = await tx.unsafe<{ row: unknown }[]>(`select to_jsonb(t) as row from "${table}" t`);
      tables[table] = { columns, rows: rows.map((r) => r.row), fingerprint: await fingerprints(tx as unknown as Sql, table) };
    }
    const [sequence] = await tx<{ last_value: string; is_called: boolean }[]>`select last_value, is_called from product_code_seq`;
    return { tables, sequence: { lastValue: String(sequence.last_value), isCalled: sequence.is_called } };
  }) as Promise<ShopData>;
}

/** Creates the tables in the target and refuses if it already holds a shop. */
export async function prepareEmptyTarget(target: Sql): Promise<void> {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  await migrate(drizzle(target), { migrationsFolder: "./src/server/db/migrations" });
  for (const table of ["products", "categories", "admin_users"]) {
    const [{ n }] = await target<{ n: number }[]>`select count(*)::int as n from ${target(table)}`;
    if (n > 0) {
      throw new Error(
        `The target already has ${n} row(s) in "${table}". Nothing was written. This only runs into an empty database, so that it can never overwrite a live shop.`,
      );
    }
  }
}

/** Writes the whole shop in one all-or-nothing step. */
export async function writeShop(target: Sql, data: ShopData): Promise<void> {
  await target.begin(async (tx) => {
    // Sample settings or shop information created by an earlier attempt are replaced.
    await tx`truncate table site_settings, ai_knowledge`;
    for (const table of TABLES) {
      const { columns, rows } = data.tables[table] ?? { columns: [], rows: [] };
      if (rows.length === 0) continue;
      if (!columns.every((c) => /^[a-z_][a-z0-9_]*$/.test(c))) throw new Error(`Unexpected column name in "${table}".`);
      const list = columns.map((c) => `"${c}"`).join(", ");
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = JSON.stringify(rows.slice(i, i + CHUNK));
        await tx.unsafe(`insert into "${table}" (${list}) select ${list} from jsonb_populate_recordset(null::"${table}", $1::jsonb)`, [chunk]);
      }
    }
    // New items continue the numbering (PLW-0034 after PLW-0033), never reusing a number.
    await tx`select setval('product_code_seq', ${data.sequence.lastValue}::bigint, ${data.sequence.isCalled})`;
  });
}

/** Compares what is now in the target with what was meant to be written. Prints a line per table. */
export async function verifyShop(target: Sql, data: ShopData): Promise<boolean> {
  let ok = true;
  const found = await readShop(target);
  for (const table of TABLES) {
    const expected = data.tables[table];
    const actual = found.tables[table];
    const same = actual.rows.length === expected.rows.length && actual.fingerprint === expected.fingerprint;
    if (!same) ok = false;
    const note = same ? "" : actual.rows.length !== expected.rows.length ? `   <- expected ${expected.rows.length}` : "   <- same count, different contents";
    console.log(`  ${table.padEnd(24)} ${String(actual.rows.length).padStart(6)}${note}`);
  }
  if (found.sequence.lastValue !== data.sequence.lastValue) {
    ok = false;
    console.log("  item numbering differs");
  }
  return ok;
}

/** The underlying reason for a failure, which the database library often wraps. Contains no password. */
export function reason(error: unknown): string {
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

export function connectionHint(error: unknown): string {
  const text = reason(error);
  if (/28P01|password authentication/i.test(text)) return " The password in the address is wrong.";
  if (/ENOTFOUND|EAI_AGAIN/i.test(text)) return ' The server name is wrong or cut short. Copy the "Session pooler" address again.';
  if (/ETIMEDOUT|ECONNREFUSED|ENETUNREACH/i.test(text)) return ' For Supabase, use the "Session pooler" address, not "Direct connection".';
  if (/Tenant or user not found/i.test(text)) return ' The user name or region is wrong. Copy the "Session pooler" address again.';
  return "";
}

export function failWith(error: unknown): never {
  const message =
    error instanceof Error && error.cause ? `${error.message}\n  Reason: ${reason(error.cause)}` : error instanceof Error ? error.message : String(error);
  console.error(`\nCould not finish: ${message}`);
  process.exit(1);
}
