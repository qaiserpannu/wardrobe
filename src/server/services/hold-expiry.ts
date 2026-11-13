import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { getSettings } from "./settings";

/**
 * Ends holds whose time is up and puts those items back to "available".
 *
 * There is no background timer: this runs (at most twice a minute) whenever
 * products are read, by the shop, the assistant or the admin portal, so an
 * expired hold is released before anyone can see it. It exposes nothing about
 * the hold itself.
 */

const CHECK_EVERY_MS = 30_000;
let lastCheck = 0;

/** Returns the codes of the items released. */
export async function releaseExpiredHolds(): Promise<string[]> {
  const { holds } = await getSettings();
  if (!holds.autoExpire) return [];
  return getDb().transaction(async (tx) => {
    const released = await tx.execute<{ id: string; code: string; name: string }>(sql`
      with ended as (
        update product_holds set ended_at = now(), end_reason = 'expired', updated_at = now()
        where ended_at is null and expires_at is not null and expires_at <= now()
        returning product_id
      )
      update products set status = 'available', updated_at = now()
      where status = 'pending' and id in (select product_id from ended)
      returning id, code, name
    `);
    for (const item of released) {
      await tx.execute(sql`
        insert into product_status_events (product_id, from_status, to_status, note)
        values (${item.id}, 'pending', 'available', 'Hold ended automatically')
      `);
      await tx.execute(sql`
        insert into audit_log (action, entity_type, entity_id, summary)
        values ('product.hold_expired', 'product', ${item.id}, ${`${item.code} ${item.name}: hold ended automatically, available again`})
      `);
    }
    return released.map((r) => r.code);
  });
}

/** Cheap to call often; does the real check at most every 30 seconds. */
export async function ensureHoldsCurrent(): Promise<void> {
  const now = Date.now();
  if (now - lastCheck < CHECK_EVERY_MS) return;
  lastCheck = now;
  try {
    await releaseExpiredHolds();
  } catch (error) {
    // Never let this housekeeping break a page.
    console.error("Could not release expired holds", error);
  }
}
