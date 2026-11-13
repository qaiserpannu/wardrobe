import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/server/db/client";
import { seed } from "@/server/db/seed";
import { AUDIT_AREAS, type AuditArea, listAudit, recordAudit } from "@/server/services/audit";

afterAll(closeDb);

describe("the record of changes", () => {
  it("lists entries newest first and filters by area", async () => {
    const marker = randomUUID();
    await recordAudit({ adminUserId: null, action: "product.status", summary: `item ${marker}` });
    await recordAudit({ adminUserId: null, action: "settings.update", summary: `setting ${marker}` });
    await recordAudit({ adminUserId: null, action: "auth.login_failed", summary: `signin ${marker}` });

    const everything = await listAudit({});
    expect(everything.items[0].summary).toBe(`signin ${marker}`);
    for (const [area, expected] of [["items", "item"], ["settings", "setting"], ["signin", "signin"]] as [AuditArea, string][]) {
      const result = await listAudit({ area });
      expect(result.items[0].summary).toBe(`${expected} ${marker}`);
      expect(result.items.every((e) => AUDIT_AREAS[area].prefixes.some((p) => e.action.startsWith(p)))).toBe(true);
    }
    expect((await listAudit({ page: 99999 })).page).toBe(everything.pageCount);
  });

  it("has no way to change or remove an entry", async () => {
    const audit = await import("@/server/services/audit");
    expect(Object.keys(audit).filter((name) => /update|delete|remove|clear|edit/i.test(name))).toEqual([]);
  });
});

describe("loading sample data", () => {
  it("refuses to wipe a database that has items added in the admin portal", async () => {
    await recordAudit({ adminUserId: null, action: "product.create", summary: "PLW-9000 Real item: created as a draft" });
    const count = async () => ((await getDb().execute(sql`select count(*)::int as n from products`)) as unknown as { n: number }[])[0].n;
    const before = await count();
    const original = process.env.DATABASE_URL;
    // Pretend this is not the test database. (The connection itself is unchanged.)
    process.env.DATABASE_URL = "postgres://example/shop";
    try {
      await expect(seed()).rejects.toThrow(/items that were added in the admin portal/);
    } finally {
      process.env.DATABASE_URL = original;
    }
    expect(await count()).toBe(before);
  });
});
