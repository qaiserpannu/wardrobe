import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

const cards = (page: Page) => page.getByTestId("product-card");
const count = (page: Page) => page.getByTestId("result-count");

/** On small screens the filters sit behind a button. */
async function openFilters(page: Page) {
  await expect(count(page)).toBeVisible(); // catalog has finished loading
  const toggle = page.getByRole("button", { name: /search & filter/i });
  if (await toggle.isVisible()) await toggle.click();
}

/** Fails the test on any browser console error, script error or failed request. */
test.beforeEach(async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
  page.on("pageerror", (e) => problems.push(`script: ${e.message}`));
  page.on("response", (r) => r.status() >= 400 && problems.push(`http ${r.status()}: ${r.url()}`));
  (page as Page & { problems: string[] }).problems = problems;
});
test.afterEach(async ({ page }) => {
  expect((page as Page & { problems: string[] }).problems).toEqual([]);
});

test.describe("homepage", () => {
  test("shows branding, hero, featured, categories, recent items and footer", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Pre-Loved Wardrobe/);
    await expect(page.getByRole("banner").getByRole("link", { name: "Pre-Loved Wardrobe" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Loved once. Ready to be loved again.");
    await expect(page.getByRole("link", { name: /shop the collection/i })).toBeVisible();

    await expect(page.getByTestId("featured").getByTestId("product-card")).toHaveCount(4);
    await expect(page.getByTestId("recent").getByTestId("product-card")).toHaveCount(8);
    await expect(page.getByTestId("category-list").getByRole("link")).toHaveCount(8);

    // Nothing on the homepage is sold.
    await expect(page.locator('[data-testid="product-card"][data-status="sold"]')).toHaveCount(0);

    const footer = page.getByRole("contentinfo");
    await expect(footer.getByRole("link", { name: /chat on whatsapp/i })).toHaveAttribute("href", /^https:\/\/wa\.me\/15555550100/);
    await expect(footer.getByRole("link", { name: "Instagram" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "hello@example.com" })).toBeVisible();
  });

  test("call-to-action and category links lead to the shop", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /shop the collection/i }).click();
    await expect(page).toHaveURL(/\/shop$/);
    await expect(page.getByRole("heading", { level: 1, name: "Shop" })).toBeVisible();

    await page.goto("/");
    await page.getByTestId("category-list").getByRole("link", { name: "Jeans" }).click();
    await expect(page).toHaveURL(/category=jeans/);
    await expect(count(page)).toHaveText("3 items");
  });

  test("product images load", async ({ page }) => {
    await page.goto("/");
    const img = page.getByTestId("featured").locator("img").first();
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  });
});

test.describe("navigation", () => {
  test("main menu reaches the shop and categories", async ({ page, isMobile }, testInfo) => {
    await page.goto("/");
    const compact = isMobile || testInfo.project.name === "tablet";
    if (compact) {
      await page.getByRole("button", { name: "Open menu" }).click();
      const menu = page.getByRole("navigation", { name: "Mobile" });
      await expect(menu).toBeVisible();
      await menu.getByRole("link", { name: "Dresses" }).click();
      await expect(page).toHaveURL(/category=dresses/);
      await expect(menu).toBeHidden(); // closes after choosing
    } else {
      await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Dresses" }).click();
      await expect(page).toHaveURL(/category=dresses/);
    }
    await expect(count(page)).toHaveText("5 items");
    await page.getByRole("banner").getByRole("link", { name: "Pre-Loved Wardrobe" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("mobile menu opens and closes", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone layout only");
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible();
    await page.getByRole("button", { name: "Close menu" }).click();
    await expect(page.getByRole("navigation", { name: "Mobile" })).toBeHidden();
  });

  test("unknown pages and unknown products show a helpful not-found page", async ({ page }) => {
    const res = await page.request.get("/no-such-page");
    expect(res.status()).toBe(404);

    const problems = (page as Page & { problems: string[] }).problems;
    await page.goto("/no-such-page");
    await expect(page.getByRole("heading", { name: /couldn't find that page/i })).toBeVisible();
    await page.goto("/shop/no-such-item-plw-9999");
    await expect(page.getByRole("heading", { name: /couldn't find that page/i })).toBeVisible();
    await page.getByRole("main").getByRole("link", { name: /browse the shop/i }).click();
    await expect(page).toHaveURL(/\/shop$/);
    // The 404 response for the first address is expected; anything else is not.
    problems.splice(0, problems.length, ...problems.filter((p) => !p.includes("404")));
  });

  test("drafts and archived items cannot be opened", async ({ page }) => {
    for (const slug of ["olive-cargo-pants-plw-0014", "suede-biker-jacket-plw-0021"]) {
      await page.goto(`/shop/${slug}`);
      await expect(page.getByRole("heading", { name: /couldn't find that page/i })).toBeVisible();
      await expect(page.getByTestId("product-detail")).toHaveCount(0);
    }
  });

  test("no broken links or images across the site", async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "one crawl is enough");
    test.setTimeout(120_000);
    const seen = new Set<string>();
    const queue = ["/"];
    const broken: string[] = [];
    while (queue.length > 0 && seen.size < 150) {
      const path = queue.shift()!;
      if (seen.has(path)) continue;
      seen.add(path);
      const res = await page.goto(path);
      if (!res || res.status() >= 400) broken.push(`${res?.status()} ${path}`);
      await expect(page.locator("main")).toBeVisible();
      if (await page.getByRole("heading", { name: /couldn't find that page|hit a snag/i }).count()) broken.push(`error page: ${path}`);
      const links = await page.locator("a[href^='/']").evaluateAll((els) => els.map((a) => a.getAttribute("href")!));
      for (const href of links) {
        const clean = href.split("#")[0];
        if (clean && !seen.has(clean) && !clean.startsWith("/_next")) queue.push(clean);
      }
      const images = await page.locator("img").evaluateAll((els) => els.map((i) => (i as HTMLImageElement).currentSrc || (i as HTMLImageElement).src));
      for (const src of new Set(images)) {
        if (!src || seen.has(src)) continue;
        seen.add(src);
        const r = await request.get(src);
        if (!r.ok()) broken.push(`${r.status()} image ${src}`);
      }
    }
    expect(broken).toEqual([]);
    expect(seen.size).toBeGreaterThan(40);
  });
});

test.describe("catalog", () => {
  test("lists all public products with paging", async ({ page }) => {
    await page.goto("/shop");
    await expect(count(page)).toHaveText("25 items");
    await expect(cards(page)).toHaveCount(12);
    await page.getByRole("navigation", { name: "Pages" }).getByRole("link", { name: "Page 3" }).click();
    await expect(page).toHaveURL(/page=3/);
    await expect(cards(page)).toHaveCount(1);
    await expect(page.getByText("Olive Cargo Pants")).toHaveCount(0);
  });

  test("sold items are marked SOLD and listed after available ones", async ({ page }) => {
    await page.goto("/shop?category=dresses");
    await expect(cards(page)).toHaveCount(5);
    const statuses = await cards(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-status")));
    expect(statuses).toEqual(["available", "available", "available", "available", "sold"]);
    const sold = cards(page).last();
    await expect(sold).toContainText("Linen Shirt Dress");
    await expect(sold.getByText("Sold", { exact: true })).toBeVisible();
    await expect(cards(page).first().getByText("Sold", { exact: true })).toHaveCount(0);
  });

  test("search by keyword", async ({ page }) => {
    await page.goto("/shop");
    await openFilters(page);
    await page.getByRole("searchbox", { name: /search by name or keyword/i }).fill("jacket");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/q=jacket/);
    await expect(count(page)).toHaveText("3 items");
    for (const name of await cards(page).getByRole("heading").allTextContents()) expect(name).toMatch(/jacket|blazer/i);
  });

  test("search with no matches explains and offers a way back", async ({ page }) => {
    await page.goto("/shop?q=tuxedo");
    await expect(page.getByTestId("no-results")).toContainText("No items match your search");
    await expect(cards(page)).toHaveCount(0);
    await page.getByRole("link", { name: "Clear all filters" }).click();
    await expect(count(page)).toHaveText("25 items");
  });

  test("header search works", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "header search box is shown from tablet width up");
    await page.goto("/");
    await page.getByRole("searchbox", { name: "Search the shop" }).fill("levi");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/shop\?q=levi/);
    await expect(count(page)).toHaveText("4 items");
  });

  test("filter by category, size, brand, condition and price", async ({ page }) => {
    await page.goto("/shop");
    await openFilters(page);

    await page.getByRole("radio", { name: /^Tops/ }).check();
    await expect(page).toHaveURL(/category=tops/);
    await expect(count(page)).toHaveText("5 items");

    await page.getByText("M", { exact: true }).click();
    await expect(page).toHaveURL(/size=M/);
    await expect(count(page)).toHaveText("3 items");

    await page.getByRole("checkbox", { name: "Mango" }).check();
    await expect(page).toHaveURL(/brand=Mango/);
    await expect(count(page)).toHaveText("1 item");
    await expect(cards(page)).toContainText(["Striped Breton Top"]);

    // Remove filters using the chips above the results.
    await page.getByRole("link", { name: /Mango.*remove filter/ }).click();
    await expect(count(page)).toHaveText("3 items");
    await page.getByRole("link", { name: "Clear all" }).click();
    await expect(count(page)).toHaveText("25 items");
    await expect(page).toHaveURL(/\/shop$/);

    await openFilters(page);
    await page.getByRole("checkbox", { name: "New with tags" }).check();
    await expect(count(page)).toHaveText("2 items");
    await page.getByRole("checkbox", { name: "New with tags" }).uncheck();
    await expect(count(page)).toHaveText("25 items");

    await page.getByRole("spinbutton", { name: "Maximum price" }).fill("15");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/max=15/);
    await expect(count(page)).toHaveText("5 items");
    const prices = await cards(page).locator("p", { hasText: "$" }).allTextContents();
    for (const p of prices) expect(Number(p.replace("$", ""))).toBeLessThanOrEqual(15);
  });

  test("hide sold items", async ({ page }) => {
    await page.goto("/shop?category=dresses");
    await openFilters(page);
    await page.getByRole("checkbox", { name: "Hide sold items" }).check();
    await expect(page).toHaveURL(/hideSold=1/);
    await expect(count(page)).toHaveText("4 items");
    await expect(page.locator('[data-testid="product-card"][data-status="sold"]')).toHaveCount(0);
  });

  test("sort by price and by newest", async ({ page }) => {
    const priceList = async () =>
      (await cards(page).locator("p", { hasText: "$" }).allTextContents()).map((p) => Number(p.replace("$", "")));

    await page.goto("/shop?hideSold=1");
    await expect(cards(page).first()).toContainText("Little Black Dress"); // newest first

    await openFilters(page);
    await page.getByRole("combobox", { name: "Sort by" }).selectOption("price_asc");
    await expect(page).toHaveURL(/sort=price_asc/);
    await expect(cards(page).first()).toContainText("Graphic Cotton Tee");
    let prices = await priceList();
    expect(prices).toEqual([...prices].sort((a, b) => a - b));

    await page.getByRole("combobox", { name: "Sort by" }).selectOption("price_desc");
    await expect(page).toHaveURL(/sort=price_desc/);
    await expect(cards(page).first()).toContainText("Leather Tote Bag");
    prices = await priceList();
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  });

  test("a filtered address can be shared and survives the back button", async ({ page }) => {
    await page.goto("/shop?category=jeans&brand=Levi%27s&sort=price_asc");
    await expect(count(page)).toHaveText("2 items");
    await openFilters(page);
    await expect(page.getByRole("radio", { name: /^Jeans/ })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Levi's" })).toBeChecked();
    await expect(page.getByRole("combobox", { name: "Sort by" })).toHaveValue("price_asc");

    await page.getByRole("checkbox", { name: "Levi's" }).uncheck();
    await expect(count(page)).toHaveText("3 items");
    await page.goBack();
    await expect(count(page)).toHaveText("2 items");
    await expect(page.getByRole("checkbox", { name: "Levi's" })).toBeChecked();
  });
});

test.describe("product page", () => {
  test("shows full details, photos and a WhatsApp inquiry naming the product", async ({ page }) => {
    await page.goto("/shop");
    await page.goto("/shop?q=black+midi");
    await cards(page).first().getByRole("link").click();
    await expect(page).toHaveURL(/\/shop\/black-midi-wrap-dress-plw-0001$/);
    await expect(page).toHaveTitle(/Black Midi Wrap Dress \| Pre-Loved Wardrobe/);

    const detail = page.getByTestId("product-detail");
    await expect(detail.getByRole("heading", { level: 1 })).toHaveText("Black Midi Wrap Dress");
    await expect(detail.getByTestId("product-price")).toHaveText("$28");
    await expect(detail.getByText("Available", { exact: true })).toBeVisible();
    await expect(detail).toContainText("Classic wrap silhouette");
    for (const [label, value] of [["Brand", "Zara"], ["Size", "M"], ["Colour", "Black"], ["Condition", "Like new"], ["Product ID", "PLW-0001"]]) {
      await expect(detail.locator("dl > div", { hasText: label }).locator("dd")).toHaveText(value);
    }

    // Photo gallery
    const main = detail.getByTestId("gallery-main");
    await expect(main).toBeVisible();
    const first = await main.getAttribute("src");
    await detail.getByRole("button", { name: "Show photo 2 of 3" }).click();
    await expect(main).not.toHaveAttribute("src", first!);

    // WhatsApp
    const wa = detail.getByRole("link", { name: /ask about this item on whatsapp/i });
    await expect(wa).toHaveAttribute("target", "_blank");
    const href = (await wa.getAttribute("href"))!;
    expect(href.startsWith("https://wa.me/15555550100?text=")).toBe(true);
    const message = new URL(href).searchParams.get("text")!;
    expect(message).toContain("Black Midi Wrap Dress");
    expect(message).toContain("PLW-0001");
    expect(message).toContain("/shop/black-midi-wrap-dress-plw-0001");

    await expect(page.getByRole("heading", { name: "More dresses" })).toBeVisible();
  });

  test("a sold product is clearly sold and cannot be inquired about", async ({ page }) => {
    await page.goto("/shop/linen-shirt-dress-plw-0004");
    const detail = page.getByTestId("product-detail");
    await expect(detail).toHaveAttribute("data-status", "sold");
    await expect(detail.getByText("Sold", { exact: true })).toBeVisible();
    await expect(detail.getByTestId("sold-notice")).toContainText("This item has been sold");
    await expect(detail.getByText("Available", { exact: true })).toHaveCount(0);
    await expect(detail.getByRole("link", { name: /whatsapp/i })).toHaveCount(0);
    await expect(detail.locator('a[href*="wa.me"]')).toHaveCount(0);
    await detail.getByRole("link", { name: /browse available dresses/i }).click();
    await expect(count(page)).toHaveText("4 items");
  });

  test("missing details are shown as not specified, never made up", async ({ page }) => {
    await page.goto("/shop/canvas-shopper-plw-0025");
    const detail = page.getByTestId("product-detail");
    for (const label of ["Brand", "Size", "Colour"]) {
      await expect(detail.locator("dl > div", { hasText: label }).locator("dd")).toHaveText("Not specified");
    }
  });

  test("marking a product sold shows up immediately everywhere", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "changes shared data; run once");
    const sql = postgres(process.env.TEST_DATABASE_URL!);
    const slug = "tan-leather-loafers-plw-0023";
    try {
      await page.goto(`/shop/${slug}`);
      await expect(page.getByTestId("product-detail")).toHaveAttribute("data-status", "available");
      await page.goto("/");
      await expect(page.getByTestId("recent")).toContainText("Tan Leather Loafers");

      await sql`update products set status = 'sold', sold_at = now() where slug = ${slug}`;

      await page.goto(`/shop/${slug}`);
      await expect(page.getByTestId("product-detail")).toHaveAttribute("data-status", "sold");
      await expect(page.locator('main a[href*="wa.me"]')).toHaveCount(0);
      await page.goto("/");
      await expect(page.getByTestId("recent")).not.toContainText("Tan Leather Loafers");
      await page.goto("/shop?category=shoes");
      await expect(cards(page).last()).toHaveAttribute("data-status", "sold");
      await expect(cards(page).last()).toContainText("Tan Leather Loafers");
    } finally {
      await sql`update products set status = 'available', sold_at = null where slug = ${slug}`;
      await sql.end();
    }
  });
});

test.describe("responsive layout", () => {
  for (const path of ["/", "/shop", "/shop/black-midi-wrap-dress-plw-0001", "/shop/linen-shirt-dress-plw-0004"]) {
    test(`no sideways scrolling on ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("contentinfo")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("layout adapts to the screen size", async ({ page, isMobile }, testInfo) => {
    await page.goto("/shop");
    await expect(cards(page).first()).toBeVisible();
    const columns = await page
      .locator("#results ul")
      .first()
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
    const desktop = testInfo.project.name === "desktop";
    expect(columns).toBe(desktop ? 3 : 2);
    await expect(page.getByRole("button", { name: /search & filter/i })).toBeVisible({ visible: !desktop });
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible({ visible: desktop });
    if (isMobile) {
      // Tap targets are comfortably large on phones.
      const box = await page.getByRole("button", { name: /search & filter/i }).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });
});
