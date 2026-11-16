import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";
import { TEST_ADMIN } from "../support/test-admin";

/** Visitor counts: public pages report views and WhatsApp taps; the admin page adds them up. */

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(TEST_ADMIN.email);
  await page.getByLabel("Password").fill(TEST_ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function query<T>(run: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 1 });
  try {
    return await run(sql);
  } finally {
    await sql.end();
  }
}

test("a visitor's pages and WhatsApp tap are counted and shown to the owner", async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name === "tablet", "desktop and phone sizes are enough");
  const [item] = await query((sql) => sql<{ id: string; slug: string; name: string }[]>`
    select id, slug, name from products where status = 'available' order by code limit 1`);
  await query((sql) => sql`delete from site_visits`);

  // A visitor arrives on the home page from Instagram, opens an item and taps WhatsApp.
  await page.goto("/?igshid=test");
  await expect.poll(() => query(async (sql) => (await sql`select 1 from site_visits where path = '/'`).length)).toBe(1);
  await page.goto(`/shop/${item.slug}`);
  const wa = page.getByTestId("product-detail").getByRole("link", { name: /ask about this item on whatsapp/i });
  await expect(wa).toBeVisible();
  // Keep the test on this page: WhatsApp itself is not opened.
  await wa.evaluate((a) => a.addEventListener("click", (e) => e.preventDefault()));
  await wa.click();
  await expect
    .poll(() => query(async (sql) => (await sql`select kind from site_visits where product_id = ${item.id}`).map((r) => r.kind).sort().join()))
    .toBe("view,whatsapp");

  const rows = await query((sql) => sql`select source, visitor_hash from site_visits order by created_at`);
  expect(rows.map((r) => r.source)).toEqual(["instagram", null, null]);
  expect(new Set(rows.map((r) => r.visitor_hash)).size).toBe(1);

  // No cookie was set for counting.
  expect((await page.context().cookies()).map((c) => c.name).filter((n) => /visit/i.test(n))).toEqual([]);

  // The owner, signed in, sees the numbers; her own browsing is not counted.
  const context = await browser.newContext({ ...testInfo.project.use, baseURL: testInfo.project.use.baseURL });
  const admin = await context.newPage();
  await signIn(admin);
  await admin.goto("/");
  await admin.goto(`/shop/${item.slug}`);
  await admin.goto("/admin/visitors");
  await expect(admin.getByRole("heading", { name: "Visitors", level: 1 })).toBeVisible();
  await expect(admin.getByTestId("today-visitors")).toHaveText("1");
  await expect(admin.getByTestId("today-views")).toHaveText("2");
  await expect(admin.getByTestId("today-whatsapp")).toHaveText("1");
  const top = admin.getByTestId("top-item");
  await expect(top).toHaveCount(1);
  await expect(top).toContainText(item.name);
  await expect(admin.getByTestId("visit-sources")).toContainText("Instagram");
  await expect(admin.getByTestId("visitor-chart")).toBeVisible();
  expect(await admin.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await admin.getByRole("link", { name: "Last 7 days" }).click();
  await expect(admin).toHaveURL(/days=7/);
  await expect(admin.getByTestId("period-views")).toHaveText("2");

  await top.getByRole("link", { name: item.name }).click();
  await expect(admin.getByTestId("item-visits")).toContainText("viewed 1 time by 1 visitor, 1 WhatsApp tap");
  expect(await query(async (sql) => (await sql`select 1 from site_visits`).length)).toBe(3);
  if (process.env.SHOT_DIR) {
    await admin.goBack();
    await expect(admin.getByTestId("visitor-chart")).toBeVisible();
    await expect(admin.getByTestId("admin-nav")).toBeVisible();
    await admin.screenshot({ path: `${process.env.SHOT_DIR}/visitors-${testInfo.project.name}.png`, fullPage: true });
  }
  await context.close();
});

test("the counting address gives nothing away and ignores other websites", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "once is enough");
  await query((sql) => sql`delete from site_visits`);
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  const post = (data: string, headers: Record<string, string> = {}) => request.post("/api/visit", { data, headers: { "user-agent": ua, "content-type": "text/plain", ...headers } });

  for (const res of [
    await post("not json"),
    await post(JSON.stringify({ kind: "view", url: "https://evil.example/" })),
    await post(JSON.stringify({ kind: "view", url: "/admin" })),
    await post(JSON.stringify({ kind: "view", url: "/" }), { origin: "https://evil.example" }),
    await post(JSON.stringify({ kind: "view", url: "/" }), { "user-agent": "Googlebot/2.1 (+http://www.google.com/bot.html)" }),
    await post(JSON.stringify({ kind: "view", url: "/", pad: "x".repeat(3000) })),
  ]) {
    expect(res.status()).toBe(204);
    expect(await res.text()).toBe("");
  }
  expect(await query(async (sql) => (await sql`select 1 from site_visits`).length)).toBe(0);

  expect((await post(JSON.stringify({ kind: "view", url: "/", entry: true }))).status()).toBe(204);
  expect(await query(async (sql) => (await sql`select 1 from site_visits`).length)).toBe(1);
  await query((sql) => sql`delete from site_visits`);
});
