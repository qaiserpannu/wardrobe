import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";
import sharp from "sharp";
import { TEST_ADMIN } from "../support/test-admin";

/** Milestone 5, part 2: adding an item, photos, publishing, holds, selling, archiving. */

const created: string[] = [];

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(TEST_ADMIN.email);
  await page.getByLabel("Password").fill(TEST_ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

const picture = (color: string) =>
  sharp({ create: { width: 900, height: 1200, channels: 3, background: color } })
    .jpeg()
    .toBuffer();

// Items made here are removed again so the other tests keep seeing only the sample data.
test.afterAll(async () => {
  if (created.length === 0) return;
  const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 1 });
  await sql`delete from products where code in ${sql(created)}`;
  await sql.end();
});

test("photo uploads are refused without signing in", async ({ request, baseURL }) => {
  const response = await request.post("/api/admin/products/00000000-0000-4000-8000-000000000000/photos", {
    headers: { origin: baseURL! },
    multipart: { file: { name: "a.jpg", mimeType: "image/jpeg", buffer: await picture("#888888") } },
  });
  expect(response.status()).toBe(401);
});

test("item pages are closed to visitors", async ({ page }) => {
  for (const path of ["/admin/products", "/admin/products/new", "/admin/products/00000000-0000-4000-8000-000000000000"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/login$/);
  }
});

test("the owner lists, filters and searches items, including hidden ones", async ({ page }) => {
  await signIn(page);
  await page.getByTestId("admin-nav").getByRole("link", { name: "Items" }).click();
  await expect(page.getByTestId("admin-result-count")).toHaveText("32 items");
  await expect(page.getByTestId("admin-product")).toHaveCount(20);

  await page.getByTestId("status-tabs").getByRole("link", { name: /^Draft/ }).click();
  await expect(page.getByTestId("admin-result-count")).toHaveText("2 items");
  await expect(page.getByTestId("admin-product-list")).toContainText("Navy Mirror Work Lehenga");

  await page.getByTestId("status-tabs").getByRole("link", { name: /^On hold/ }).click();
  await expect(page.getByTestId("admin-product").first()).toContainText("Held for Sample customer");

  await page.getByTestId("status-tabs").getByRole("link", { name: /^All/ }).click();
  await page.getByLabel("Search items").fill("PLW-0020");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByTestId("admin-result-count")).toHaveText("1 item");
  await expect(page.getByTestId("admin-product")).toContainText("Gold Tissue Anarkali Gown");
});

test("an item goes from draft to published, on hold, sold, back, and archived", async ({ page, browser }, testInfo) => {
  test.setTimeout(90_000);
  const name = `Peacock Test Suit ${testInfo.project.name}`;
  // A second, signed-out browser plays the customer.
  const visitor = await (await browser.newContext()).newPage();
  page.on("dialog", (dialog) => dialog.accept());
  // Earlier screens can stay in the page, hidden, after moving on; only look at what is showing.
  const form = page.locator('[data-testid="product-form"]:visible');
  const holdForm = page.locator('[data-testid="hold-form"]:visible');
  await signIn(page);

  // The form explains what is missing.
  await page.goto("/admin/products");
  await page.locator('[data-testid="add-item"]:visible').click();
  await form.getByRole("button", { name: "Save as draft and add photos" }).click();
  await expect(page.locator('[data-testid="form-message"]:visible')).toContainText("check the highlighted");
  await expect(page.locator('[data-testid="error-price"]:visible')).toBeVisible();
  await expect(page.locator('[data-testid="error-categoryId"]:visible')).toBeVisible();

  // A failed save keeps what was typed.
  await form.getByLabel("Name").fill("Half finished");
  await form.getByRole("button", { name: "Save as draft and add photos" }).click();
  await expect(page.locator('[data-testid="error-price"]:visible')).toBeVisible();
  await expect(form.getByLabel("Name")).toHaveValue("Half finished");

  await form.getByLabel("Name").fill(name);
  await form.getByLabel("Category").selectOption({ label: "Women · Shalwar Kameez" });
  await form.getByLabel("Price (US dollars)").fill("64.50");
  await form.getByLabel("Description").fill("Made by the browser test.");
  await form.getByLabel("Condition").selectOption("like_new");
  await form.getByLabel("Size").fill("M");
  await form.getByLabel("Imperfections").fill("Tiny pull near the hem.");
  await form.getByRole("button", { name: "Save as draft and add photos" }).click();

  await expect(page.locator('[data-testid="created-notice"]:visible')).toBeVisible();
  const code = (await page.locator('[data-testid="product-code"]:visible').textContent())!.trim();
  created.push(code);
  const slug = `peacock-test-suit-${testInfo.project.name}-${code.toLowerCase()}`;
  const panel = page.locator('[data-testid="status-panel"]:visible');
  await expect(panel).toHaveAttribute("data-status", "draft");

  // A draft is invisible to customers and cannot be published without a photo.
  await visitor.goto(`/shop/${slug}`);
  await expect(visitor.getByTestId("not-found")).toBeVisible();
  await expect(page.locator('[data-testid="status-available"]:visible')).toBeDisabled();

  // A file that is not a photo is refused, whatever it is called.
  await page.locator('[data-testid="photo-input"]:visible').setInputFiles({ name: "holiday.jpg", mimeType: "image/jpeg", buffer: Buffer.from("<script>alert(1)</script>") });
  await expect(page.locator('[data-testid="photo-errors"]:visible')).toContainText("holiday.jpg");
  await expect(page.locator('[data-testid="photo"]:visible')).toHaveCount(0);

  await page.locator('[data-testid="photo-input"]:visible').setInputFiles([
    { name: "front.jpg", mimeType: "image/jpeg", buffer: await picture("#1f6f6a") },
    { name: "back.jpg", mimeType: "image/jpeg", buffer: await picture("#d1a02c") },
  ]);
  await expect(page.locator('[data-testid="photo"]:visible')).toHaveCount(2);
  const firstBefore = await page.locator('[data-testid="photo"]:visible').first().locator("img").getAttribute("src");
  await page.getByRole("button", { name: "Move photo 2 earlier" }).filter({ visible: true }).click();
  await expect(page.locator('[data-testid="photo"]:visible').first().locator("img")).not.toHaveAttribute("src", firstBefore!);

  // Preview shows the draft as customers would see it.
  await page.locator('[data-testid="preview-link"]:visible').click();
  await expect(page.locator('[data-testid="preview-notice"]:visible')).toContainText("customers cannot see it");
  await expect(page.locator('[data-testid="product-detail"]:visible')).toContainText(name);
  await expect(page.locator('[data-testid="product-detail"]:visible')).toContainText("Tiny pull near the hem.");
  await page.getByRole("link", { name: "Back to editing" }).click();

  // Publish: on the website at once.
  await page.locator('[data-testid="status-available"]:visible').click();
  await expect(panel).toHaveAttribute("data-status", "available");
  await visitor.goto(`/shop/${slug}`);
  await expect(visitor.getByTestId("product-detail")).toHaveAttribute("data-status", "available");
  await expect(visitor.getByTestId("product-price")).toHaveText("$64.50");
  await expect(visitor.getByTestId("product-detail").locator("img").first()).toBeVisible();

  // An edit appears at once, and the address does not change.
  await form.getByLabel("Price (US dollars)").fill("59");
  await form.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator('[data-testid="form-message"]:visible')).toHaveText("Saved.");
  await visitor.reload();
  await expect(visitor.getByTestId("product-price")).toHaveText("$59");

  // On hold: customers see the badge and nothing about who it is for.
  await page.locator('[data-testid="open-hold-form"]:visible').click();
  await page.locator('[data-testid="hold-form"]:visible').getByRole("button", { name: "Put on hold" }).click();
  await expect(panel).toHaveAttribute("data-status", "available"); // a name is required
  await holdForm.getByLabel("Held for").fill("Zainab Hiddenname");
  await holdForm.getByLabel("Private note (optional)").fill("Paying by Zelle on Friday");
  await page.locator('[data-testid="hold-form"]:visible').getByRole("button", { name: "Put on hold" }).click();
  await expect(panel).toHaveAttribute("data-status", "pending");
  await expect(page.locator('[data-testid="hold-details"]:visible')).toContainText("Zainab Hiddenname");
  await expect(page.locator('[data-testid="hold-expiry"]:visible')).toContainText("in 3 days");

  await visitor.reload();
  await expect(visitor.getByTestId("product-detail")).toHaveAttribute("data-status", "pending");
  await expect(visitor.getByTestId("hold-notice")).toBeVisible();
  const visitorHtml = await visitor.content();
  expect(visitorHtml).not.toContain("Hiddenname");
  expect(visitorHtml).not.toContain("Zelle on Friday");

  // Extend the hold.
  await page.locator('[data-testid="open-hold-form"]:visible').click();
  await holdForm.getByLabel("Change when the hold ends").selectOption("168");
  await holdForm.getByRole("button", { name: "Save hold" }).click();
  await expect(page.locator('[data-testid="hold-expiry"]:visible')).toContainText("in 7 days");

  // Sold, then undone.
  await page.locator('[data-testid="status-sold"]:visible').click();
  await expect(panel).toHaveAttribute("data-status", "sold");
  await visitor.reload();
  await expect(visitor.getByTestId("sold-notice")).toBeVisible();
  await page.locator('[data-testid="status-available"]:visible').click();
  await expect(panel).toHaveAttribute("data-status", "available");
  await visitor.reload();
  await expect(visitor.getByTestId("product-detail")).toHaveAttribute("data-status", "available");

  await expect(page.locator('[data-testid="status-history"]:visible')).toContainText("On hold → Sold");
  await expect(page.locator('[data-testid="status-history"]:visible')).toContainText(TEST_ADMIN.name);

  // Archive: gone from the website, still in admin.
  await page.locator('[data-testid="status-archived"]:visible').click();
  await expect(panel).toHaveAttribute("data-status", "archived");
  await visitor.reload();
  await expect(visitor.getByTestId("not-found")).toBeVisible();
  await page.goto(`/admin/products?status=archived&q=${code}`);
  await expect(page.locator('[data-testid="admin-product"]:visible')).toContainText(name);
  await visitor.context().close();
});
