import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";
import { TEST_ADMIN } from "../support/test-admin";

/** The Share box on an item: words written from the item, photos handed over as JPEG. */

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(TEST_ADMIN.email);
  await page.getByLabel("Password").fill(TEST_ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function item(status: string) {
  const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 1 });
  try {
    const [row] = await sql<{ id: string; code: string; name: string; slug: string; photos: number }[]>`
      select p.id, p.code, p.name, p.slug, (select count(*)::int from product_images i where i.product_id = p.id) as photos
      from products p where p.status = ${status}::product_status
      and exists (select 1 from product_images i where i.product_id = p.id)
      order by p.code limit 1`;
    return row;
  } finally {
    await sql.end();
  }
}

test("an available item can be shared: words, copy, photos as JPEG", async ({ page, context, browserName }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop" && testInfo.project.name !== "mobile", "desktop and phone sizes are enough");
  const product = await item("available");
  await signIn(page);

  // Stand in for a phone's share menu and record what it is given.
  await page.addInitScript(() => {
    const w = window as unknown as { __shared?: unknown };
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: { files?: File[]; text?: string; title?: string }) => {
        w.__shared = { text: data.text, title: data.title, files: (data.files ?? []).map((f) => ({ name: f.name, type: f.type, size: f.size })) };
      },
    });
  });
  if (browserName === "chromium") await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  await page.goto(`/admin/products/${product.id}`);
  const panel = page.getByTestId("share-panel");
  const words = panel.getByLabel(/The words/);
  await expect(words).toHaveValue(new RegExp(`^${product.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} - \\$`));
  await expect(words).toHaveValue(new RegExp(`/shop/${product.slug}`));
  await expect(words).toHaveValue(new RegExp(`Item ${product.code}$`));

  // The owner can adjust the words; what is shared is what she sees.
  await words.fill(`${await words.inputValue()}\nMessage me to arrange pickup.`);
  await panel.getByRole("button", { name: "Share…" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __shared?: unknown }).__shared)).toBeTruthy();
  const shared = (await page.evaluate(() => (window as unknown as { __shared?: unknown }).__shared)) as {
    text: string;
    files: { name: string; type: string; size: number }[];
  };
  expect(shared.text).toContain("Message me to arrange pickup.");
  expect(shared.files.length).toBe(Math.min(product.photos, 10));
  for (const file of shared.files) {
    expect(file.type).toBe("image/jpeg");
    expect(file.name).toMatch(new RegExp(`^${product.code.toLowerCase()}-\\d+\\.jpg$`));
    expect(file.size).toBeGreaterThan(500);
  }

  await panel.getByRole("button", { name: "Copy the words" }).click();
  await expect(page.getByTestId("share-message")).toContainText("Copied");
  if (browserName === "chromium") {
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(`Item ${product.code}`);
  }

  const download = page.waitForEvent("download");
  await panel.getByRole("button", { name: "Download photos" }).click();
  expect((await download).suggestedFilename()).toBe(`${product.code.toLowerCase()}-1.jpg`);
  await expect(page.getByTestId("share-message")).toContainText("saved to your downloads");
});

test("a sold item shows a reminder and no Share box", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "once is enough");
  const product = await item("sold");
  await signIn(page);
  await page.goto(`/admin/products/${product.id}`);
  await expect(page.getByTestId("listed-elsewhere-reminder")).toContainText("mark it sold there too");
  await expect(page.getByTestId("share-panel")).toHaveCount(0);
});
