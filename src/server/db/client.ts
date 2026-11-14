import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { connectionOptions, isLocalDatabase } from "./connection";
import * as schema from "./schema";

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  }
  // On hosting, each request handler holds few connections so the provider's pooler is not exhausted.
  const max = Number(process.env.DATABASE_POOL_MAX) || (isLocalDatabase(url) ? 10 : 3);
  return postgres(url, { max, idle_timeout: 20, ...connectionOptions(url) });
}

// Reuse one connection pool across hot reloads in development.
const globalForDb = globalThis as unknown as { __plwSql?: ReturnType<typeof postgres> };

export function getSql() {
  globalForDb.__plwSql ??= createClient();
  return globalForDb.__plwSql;
}

export function getDb() {
  return drizzle(getSql(), { schema });
}

export async function closeDb() {
  if (globalForDb.__plwSql) {
    await globalForDb.__plwSql.end({ timeout: 5 });
    globalForDb.__plwSql = undefined;
  }
}

export { schema };
