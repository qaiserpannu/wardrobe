import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  }
  // "prepare: false" keeps us compatible with pooled connections (e.g. Supabase).
  return postgres(url, { max: 10, prepare: false, onnotice: () => {} });
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
