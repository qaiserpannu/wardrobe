import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/server/db/client";
import { products, siteVisits } from "@/server/db/schema";
import { getProductVisitTotals, getVisitReport } from "@/server/services/admin-visits";
import { recordVisit, type VisitInput } from "@/server/services/visits";

const db = getDb();
const PHONE = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const TAMPA = { country: "United States", region: "Florida", city: "Tampa" };

const visit = (over: Partial<VisitInput> = {}): VisitInput => ({
  kind: "view",
  url: "/",
  entry: true,
  address: "203.0.113.5",
  userAgent: PHONE,
  ownHost: "preloved-wardrobe.com",
  place: TAMPA,
  ...over,
});

async function slugWith(status: "available" | "sold" | "draft") {
  const [row] = await db.select({ id: products.id, slug: products.slug, name: products.name }).from(products).where(eq(products.status, status)).limit(1);
  return row;
}

beforeEach(async () => {
  await db.delete(siteVisits);
});
afterAll(async () => {
  await db.delete(siteVisits);
  await closeDb();
});

describe("counting visits", () => {
  it("counts a page view with its source and place, and stores no address", async () => {
    expect(await recordVisit(visit({ referrer: "https://l.facebook.com/l.php?u=x", address: "203.0.113.77" }))).toBe(true);
    const [row] = await db.select().from(siteVisits);
    expect(row).toMatchObject({ kind: "view", path: "/", source: "facebook", referrerHost: "l.facebook.com", city: "Tampa", productId: null });
    expect(JSON.stringify(row)).not.toContain("203.0.113.77");
    expect(row.visitorHash).toMatch(/^[0-9a-f]{32}$/);
  });

  it("links an item page to its item and ignores the query string", async () => {
    const item = await slugWith("available");
    await recordVisit(visit({ url: `/shop/${item.slug}?fbclid=abc` }));
    const [row] = await db.select().from(siteVisits);
    expect(row).toMatchObject({ path: `/shop/${item.slug}`, productId: item.id, source: "facebook" });
  });

  it("does not count search engines, drafts, unknown pages or the admin area", async () => {
    const draft = await slugWith("draft");
    expect(await recordVisit(visit({ userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" }))).toBe(false);
    expect(await recordVisit(visit({ userAgent: null }))).toBe(false);
    expect(await recordVisit(visit({ url: `/shop/${draft.slug}` }))).toBe(false);
    expect(await recordVisit(visit({ url: "/shop/no-such-item" }))).toBe(false);
    expect(await recordVisit(visit({ url: "/admin" }))).toBe(false);
    expect(await recordVisit(visit({ url: "/wp-login.php" }))).toBe(false);
    expect(await db.select().from(siteVisits)).toHaveLength(0);
  });

  it("does not count the same page twice in a short time, but does after a while", async () => {
    const start = new Date("2026-11-10T15:00:00Z");
    expect(await recordVisit(visit({ now: start }))).toBe(true);
    expect(await recordVisit(visit({ now: new Date(start.getTime() + 5 * 60_000) }))).toBe(false);
    expect(await recordVisit(visit({ now: new Date(start.getTime() + 5 * 60_000), url: "/shop" }))).toBe(true);
    expect(await recordVisit(visit({ now: new Date(start.getTime() + 45 * 60_000) }))).toBe(true);
  });

  it("only the first page of a visit carries a source", async () => {
    await recordVisit(visit({ referrer: "https://www.google.com/" }));
    await recordVisit(visit({ url: "/shop", entry: false, referrer: "https://www.google.com/" }));
    const rows = await db.select().from(siteVisits).orderBy(siteVisits.path);
    expect(rows.map((r) => r.source)).toEqual(["google", null]);
  });

  it("gives one person a different code on a different day", async () => {
    await recordVisit(visit({ now: new Date("2026-11-10T15:00:00Z") }));
    await recordVisit(visit({ now: new Date("2026-11-11T15:00:00Z") }));
    const rows = await db.select().from(siteVisits);
    expect(new Set(rows.map((r) => r.visitorHash)).size).toBe(2);
  });
});

describe("the visitors report", () => {
  it("adds up visitors, views, WhatsApp taps, items, sources and places", async () => {
    const item = await slugWith("available");
    const sold = await slugWith("sold");
    // Two people today: one from Instagram who looks at an item and taps WhatsApp, one direct from Orlando.
    await recordVisit(visit({ referrer: "https://www.instagram.com/" }));
    await recordVisit(visit({ url: `/shop/${item.slug}`, entry: false }));
    await recordVisit(visit({ kind: "whatsapp", url: `/shop/${item.slug}`, entry: false }));
    const other = { address: "198.51.100.9", place: { country: "United States", region: "Florida", city: "Orlando" } };
    await recordVisit(visit({ ...other, url: `/shop/${item.slug}` }));
    await recordVisit(visit({ ...other, url: `/shop/${sold.slug}`, entry: false }));
    // And one visit 20 days ago.
    await recordVisit(visit({ address: "192.0.2.1", now: new Date(Date.now() - 20 * 86_400_000) }));

    const month = await getVisitReport(30, "America/New_York");
    expect(month).not.toBeNull();
    expect(month!.today).toEqual({ visitors: 2, views: 4, whatsapp: 1 });
    expect(month!.period).toEqual({ visitors: 3, views: 5, whatsapp: 1 });
    expect(month!.daily).toHaveLength(30);
    expect(month!.daily.at(-1)).toMatchObject({ visitors: 2, views: 4 });
    expect(month!.items[0]).toMatchObject({ id: item.id, views: 2, visitors: 2, whatsapp: 1 });
    expect(month!.items[1]).toMatchObject({ id: sold.id, views: 1 });
    expect(Object.fromEntries(month!.sources.map((s) => [s.source, s.visits]))).toEqual({ direct: 2, instagram: 1 });
    expect(month!.sources.find((s) => s.source === "instagram")!.label).toBe("Instagram");
    expect(month!.places[0]).toEqual({ place: "Tampa, Florida, United States", visitors: 2 });
    expect(month!.pages).toEqual([{ path: "/", views: 2 }]);

    const week = await getVisitReport(7, "America/New_York");
    expect(week!.period).toEqual({ visitors: 2, views: 4, whatsapp: 1 });
    expect(week!.daily).toHaveLength(7);

    expect(await getProductVisitTotals(item.id)).toEqual({ visitors: 2, views: 2, whatsapp: 1 });
  });

  it("keeps the count when an item is deleted, and says so plainly when the table is missing", async () => {
    await recordVisit(visit());
    await db.execute(sql`alter table site_visits rename to site_visits_away`);
    try {
      expect(await getVisitReport(30, "America/New_York")).toBeNull();
      expect(await getProductVisitTotals("00000000-0000-0000-0000-000000000000")).toBeNull();
      expect(await recordVisit(visit({ url: "/shop" }))).toBe(false);
    } finally {
      await db.execute(sql`alter table site_visits_away rename to site_visits`);
    }
  });
});
