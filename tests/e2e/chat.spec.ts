import { expect, test, type Page } from "@playwright/test";

const launcher = (page: Page) => page.getByTestId("chat-launcher");
const panel = (page: Page) => page.getByTestId("chat-panel");
const startLink = (page: Page) => page.getByTestId("chat-start");

async function message(page: Page) {
  const href = (await startLink(page).getAttribute("href"))!;
  const url = new URL(href);
  expect(url.origin + url.pathname).toBe("https://wa.me/15555550100");
  return url.searchParams.get("text")!;
}

test.beforeEach(async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (m) => {
    // A deliberately missing page makes the browser log its own 404; that is expected.
    if (m.type() === "error" && !/status of 404/.test(m.text())) problems.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`script: ${e.message}`));
  (page as Page & { problems: string[] }).problems = problems;
});
test.afterEach(async ({ page }) => {
  expect((page as Page & { problems: string[] }).problems).toEqual([]);
});

test.describe("chat widget", () => {
  for (const path of ["/", "/shop", "/shop/teal-embroidered-lawn-suit-plw-0001", "/shop/no-such-item", "/nothing-here"]) {
    test(`is on the page ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(launcher(page)).toBeVisible();
      await expect(launcher(page)).toHaveAttribute("aria-expanded", "false");
      await expect(panel(page)).toHaveCount(0);
    });
  }

  test("opens with a greeting and a WhatsApp link to a person, then closes", async ({ page }) => {
    await page.goto("/");
    await launcher(page).click();
    await expect(panel(page)).toBeVisible();
    await expect(launcher(page)).toHaveAttribute("aria-expanded", "true");
    await expect(panel(page)).toHaveAttribute("data-mode", "assistant");
    await expect(panel(page)).toContainText("Shop assistant");
    await expect(panel(page)).toContainText("I'm the shop's AI assistant");
    await expect(page.getByTestId("chat-disclosure")).toContainText("You are chatting with an AI assistant");
    await expect(startLink(page)).toHaveText(/talk to a person on whatsapp/i);
    await expect(startLink(page)).toHaveAttribute("target", "_blank");
    await expect(startLink(page)).toHaveAttribute("rel", /noopener/);
    expect(await message(page)).toBe("Hi! I have a question about Pre-Loved Wardrobe.");
    await expect(page.getByTestId("chat-product")).toHaveCount(0);

    await panel(page).getByRole("button", { name: "Close chat" }).click();
    await expect(panel(page)).toHaveCount(0);
    await expect(launcher(page)).toBeFocused();

    // The round button also toggles it.
    await launcher(page).click();
    await expect(panel(page)).toBeVisible();
    await launcher(page).click();
    await expect(panel(page)).toHaveCount(0);
  });

  test("works from the keyboard", async ({ page }) => {
    await page.goto("/");
    await launcher(page).focus();
    await page.keyboard.press("Enter");
    await expect(panel(page)).toBeVisible();
    await expect(page.getByTestId("chat-input")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(panel(page)).toHaveCount(0);
    await expect(launcher(page)).toBeFocused();
  });

  test("closes when clicking elsewhere on the page", async ({ page }) => {
    await page.goto("/");
    await launcher(page).click();
    await expect(panel(page)).toBeVisible();
    await page.mouse.click(8, 8); // the top corner of the page, outside the panel
    await expect(panel(page)).toHaveCount(0);
  });

  test("on a product page the message names the product and its ID", async ({ page }) => {
    await page.goto("/shop/teal-embroidered-lawn-suit-plw-0001");
    await expect(page.getByTestId("product-detail")).toBeVisible();
    await launcher(page).click();
    await expect(page.getByTestId("chat-product")).toContainText("Teal Embroidered Lawn Suit");
    await expect(page.getByTestId("chat-product")).toContainText("PLW-0001");
    const text = await message(page);
    expect(text).toContain("Teal Embroidered Lawn Suit");
    expect(text).toContain("ID: PLW-0001");
    expect(text).toContain("/shop/teal-embroidered-lawn-suit-plw-0001");
  });

  test("forgets the product after leaving its page", async ({ page }) => {
    await page.goto("/shop/teal-embroidered-lawn-suit-plw-0001");
    await expect(page.getByTestId("product-detail")).toBeVisible();
    await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Shop" }).click();
    await expect(page.getByTestId("result-count")).toBeVisible();
    await launcher(page).click();
    await expect(page.getByTestId("chat-product")).toHaveCount(0);
    expect(await message(page)).toBe("Hi! I have a question about Pre-Loved Wardrobe.");
  });

  for (const [what, slug] of [
    ["sold", "mustard-cotton-printed-suit-plw-0004"],
    ["on-hold", "sage-green-organza-saree-plw-0031"],
  ]) {
    test(`does not offer to buy a ${what} item`, async ({ page }) => {
      await page.goto(`/shop/${slug}`);
      await expect(page.getByTestId("product-detail")).toBeVisible();
      await launcher(page).click();
      await expect(page.getByTestId("chat-product")).toHaveCount(0);
      expect(await message(page)).toBe("Hi! I have a question about Pre-Loved Wardrobe.");
    });
  }

  test("fits on the screen and does not cause sideways scrolling", async ({ page }) => {
    await page.goto("/shop");
    await expect(page.getByTestId("result-count")).toBeVisible();
    await launcher(page).click();
    await expect(panel(page)).toBeVisible();
    const viewport = page.viewportSize()!;
    for (const el of [panel(page), launcher(page)]) {
      const box = (await el.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // Big enough to tap.
    const size = (await launcher(page).boundingBox())!;
    expect(Math.min(size.width, size.height)).toBeGreaterThanOrEqual(48);
  });
});
