import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";

/** True when the database answers. Used by the "is the site up" address; reveals nothing else. */
export async function isDatabaseUp(): Promise<boolean> {
  try {
    await getDb().execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}
