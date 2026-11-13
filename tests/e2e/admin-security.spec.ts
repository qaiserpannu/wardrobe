import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";
import { TEST_ADMIN } from "../support/test-admin";

/** Milestone 5, part 5: the Activity page and the security review's checks. */

const created: string[] = [];

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(TEST_ADMIN.email);
  await page.getByLabel("Password").fill(TEST_ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.afterAll(async () => {
  if (created.length === 0) return;
  const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 1 });
  await sql`delete from categories where name in ${sql(created)}`;
  await sql.end();
});

test("every response carries the protective headers, and search engines are kept out of admin", async ({ request }) => {
  for (const path of ["/", "/shop", "/admin/login"]) {
    const headers = (await request.get(path)).headers();
    expect(headers["x-frame-options"], path).toBe("DENY");
    expect(headers["x-content-type-options"], path).toBe("nosniff");
    expect(headers["content-security-policy"], path).toContain("frame-ancestors 'none'");
    expect(headers["strict-transport-security"], path).toContain("max-age=");
    expect(headers["permissions-policy"], path).toContain("geolocation=()");
  }
  const admin = (await request.get("/admin/login")).headers();
  expect(admin["cache-control"]).toContain("no-store");
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/Disallow: \/admin/);
  expect(robots).toMatch(/Disallow: \/api\//);
});

test("nothing about admin is sent to a visitor's browser", async ({ page }) => {
  const responses: string[] = [];
  page.on("response", async (response) => {
    const type = response.headers()["content-type"] ?? "";
    if (/javascript|html|json|text\/x-component/.test(type)) responses.push(await response.text().catch(() => ""));
  });
  await page.goto("/");
  await page.goto("/shop/teal-embroidered-lawn-suit-plw-0001");
  await page.goto("/admin/login");
  await page.waitForLoadState("networkidle");
  const everything = responses.join("\n");
  for (const secret of ["password_hash", "passwordHash", "token_hash", "DATABASE_URL", "ANTHROPIC_API_KEY", "Sample customer", "customer_contact", TEST_ADMIN.email]) {
    expect(everything.includes(secret), secret).toBe(false);
  }
});

test("an admin action cannot be run by someone who is not signed in", async ({ page, playwright, baseURL }, testInfo) => {
  page.on("dialog", (dialog) => dialog.accept());
  const real = `Guard Real ${testInfo.project.name}`;
  const forged = `Guard Forged ${testInfo.project.name}`;
  created.push(real, forged);

  // The owner adds a category; the exact request the browser sent is captured.
  await signIn(page);
  await page.goto("/admin/categories");
  const manager = page.getByTestId("category-manager");
  await manager.getByTestId("add-group").getByLabel("New group name").fill(real);
  const [sent] = await Promise.all([
    page.waitForRequest((r) => r.method() === "POST" && Boolean(r.headers()["next-action"])),
    manager.getByTestId("add-group").getByRole("button", { name: "Add" }).click(),
  ]);
  const group = manager.locator(`[data-testid="category-group"][data-name="${real}"]`);
  await expect(group).toBeVisible();
  const body = sent.postData()!;
  expect(body).toContain(real);

  // The same request, for a different name, replayed with no session and with an invented one.
  const headers = { ...sent.headers() };
  delete headers.cookie;
  delete headers["content-length"];
  for (const cookie of [undefined, "plw_admin=made-up-session-value"]) {
    const stranger = await playwright.request.newContext({ baseURL });
    const response = await stranger.post(sent.url(), {
      headers: { ...headers, ...(cookie ? { cookie } : {}) },
      data: body.replaceAll(real, forged),
      maxRedirects: 0,
    });
    const redirect = response.headers()["x-action-redirect"] ?? response.headers().location ?? "";
    expect(redirect, `cookie: ${cookie}`).toContain("/admin/login");
    await stranger.dispose();
  }
  // A request from another website is refused even with a session cookie.
  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name === "plw_admin")!;
  const elsewhere = await playwright.request.newContext({ baseURL });
  const crossSite = await elsewhere.post(sent.url(), {
    headers: { ...headers, origin: "https://evil.example", cookie: `plw_admin=${session.value}` },
    data: body.replaceAll(real, forged),
    maxRedirects: 0,
  });
  expect(crossSite.ok()).toBe(false);
  await elsewhere.dispose();

  await page.reload();
  await expect(manager.locator(`[data-testid="category-group"][data-name="${forged}"]`)).toHaveCount(0);

  // Hide the test's own group again so the shop looks as before.
  await group.getByRole("button", { name: `Hide ${real}` }).click();
  await expect(group.getByRole("button", { name: `Show ${real}` })).toBeVisible();
});

test("the Activity page shows what was done, and by whom", async ({ page }) => {
  await signIn(page);
  await page.getByTestId("admin-nav").getByRole("link", { name: "Activity" }).click();
  await expect(page.getByTestId("activity-entry").first()).toContainText(`${TEST_ADMIN.name} signed in`);
  await expect(page.getByTestId("activity-entry").first()).toContainText(TEST_ADMIN.name);

  await page.getByTestId("activity-tabs").getByRole("link", { name: "Sign-in" }).click();
  await expect(page).toHaveURL(/area=signin/);
  await expect(page.getByTestId("activity-entry").first()).toContainText("signed in");
  await page.getByTestId("activity-tabs").getByRole("link", { name: "Categories" }).click();
  await expect(page).toHaveURL(/area=categories/);
  await expect(page.getByTestId("activity-list")).not.toContainText("signed in");
  // No entry offers a way to edit or remove it.
  await expect(page.getByTestId("activity-list").getByRole("button")).toHaveCount(0);
});

test("the Activity page is closed to visitors", async ({ page }) => {
  await page.goto("/admin/activity");
  await expect(page).toHaveURL(/\/admin\/login$/);
});
