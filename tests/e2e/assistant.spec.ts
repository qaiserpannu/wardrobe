import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

/**
 * The AI assistant panel, driven through a real browser. The AI model itself is
 * replaced by a fixed-rule stand-in (AI_PROVIDER=test), so these tests check
 * everything around the model: the chat screen, the product cards, the
 * safeguards and what gets recorded.
 */

const panel = (page: Page) => page.getByTestId("chat-panel");
const replies = (page: Page) => page.getByTestId("chat-message-assistant");
const cards = (page: Page) => page.getByTestId("chat-card");

async function open(page: Page, path = "/") {
  await page.goto(path);
  await page.getByTestId("chat-launcher").click();
  await expect(panel(page)).toBeVisible();
}

/** Sends a message and waits for the assistant's answer to it. */
async function say(page: Page, text: string) {
  const before = await replies(page).count();
  await page.getByTestId("chat-input").fill(text);
  await page.getByTestId("chat-send").click();
  await expect(replies(page)).toHaveCount(before + 1);
  await expect(page.getByTestId("chat-typing")).toHaveCount(0);
  return replies(page).last();
}

test.beforeEach(async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
  page.on("pageerror", (e) => problems.push(`script: ${e.message}`));
  (page as Page & { problems: string[] }).problems = problems;
});
test.afterEach(async ({ page }) => {
  expect((page as Page & { problems: string[] }).problems).toEqual([]);
});

test.describe("AI assistant chat", () => {
  test("greets as Skyra, is honest that it is a virtual assistant, and always offers a person", async ({ page }) => {
    await open(page);
    await expect(replies(page).first()).toContainText("Assalam o Alaikum! I'm Skyra. May I know your name?");
    await expect(page.getByTestId("chat-disclosure")).toContainText("Skyra is the shop's virtual AI assistant");
    await expect(page.getByTestId("chat-start")).toHaveAttribute("href", /^https:\/\/wa\.me\/15555550100/);
  });

  test("finds products and shows cards that come from the shop's records", async ({ page }) => {
    await open(page);
    const reply = await say(page, "do you have any lehenga");
    await expect(reply).toContainText("I found 2 available");
    await expect(cards(page)).toHaveCount(2);
    const card = cards(page).filter({ hasText: "Red Bridal Lehenga Choli" });
    await expect(card).toContainText("$320");
    await expect(card).toContainText("Size M");
    await expect(card).toContainText("Like new");
    await expect(card).toContainText("PLW-0011");
    await expect(card.locator("img")).toBeVisible();
    await card.click();
    await expect(page).toHaveURL(/\/shop\/red-bridal-lehenga-choli-plw-0011$/);
    await expect(page.getByTestId("product-detail")).toBeVisible();
  });

  test("says so when nothing matches", async ({ page }) => {
    await open(page);
    await expect(await say(page, "any tuxedo")).toContainText("couldn't find anything");
    await expect(cards(page)).toHaveCount(0);
  });

  test("sends with the Enter key and keeps the message box ready", async ({ page }) => {
    await open(page);
    await page.getByTestId("chat-input").fill("any saree");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("chat-message-customer")).toHaveText("any saree");
    await expect(replies(page)).toHaveCount(2);
    await expect(page.getByTestId("chat-input")).toHaveValue("");
    await expect(page.getByTestId("chat-send")).toBeDisabled(); // nothing typed
  });

  test("shows sold and on-hold items as such", async ({ page }) => {
    await open(page);
    await expect(await say(page, "tell me about PLW-0004")).toContainText("currently sold");
    await expect(cards(page).last()).toHaveAttribute("data-status", "sold");
    await expect(cards(page).last()).toContainText("Sold");
    await expect(await say(page, "and PLW-0031")).toContainText("currently on hold");
    await expect(cards(page).last()).toContainText("On hold");
    // Trying to buy one is turned down and nothing is passed to the owner.
    await expect(await say(page, "I want to buy PLW-0004")).toContainText("not available to buy");
  });

  test("never shows an invented product", async ({ page }) => {
    await open(page);
    const reply = await say(page, "show me something made-up");
    await expect(reply).toContainText("Let me double-check that");
    await expect(panel(page)).not.toContainText("PLW-9999");
    await expect(panel(page)).not.toContainText("diamond");
    await expect(cards(page)).toHaveCount(0);
  });

  test("knows which product page the visitor is on", async ({ page }) => {
    await open(page, "/shop/teal-embroidered-lawn-suit-plw-0001");
    await expect(page.getByTestId("chat-product")).toContainText("Teal Embroidered Lawn Suit");
    const href = (await page.getByTestId("chat-start").getAttribute("href"))!;
    expect(new URL(href).searchParams.get("text")).toContain("ID: PLW-0001");
  });

  test("a purchase request is passed to the owner without reserving the item", async ({ page }) => {
    const sql = postgres(process.env.TEST_DATABASE_URL!);
    try {
      await open(page);
      const before = (await sql`select count(*)::int as n from notifications where kind = 'purchase_request'`)[0].n;
      const reply = await say(page, "I want to buy PLW-0002");
      await expect(reply).toContainText("passed your request for PLW-0002 to the owner");
      await expect(reply).toContainText("not reserved");
      const after = (await sql`select count(*)::int as n from notifications where kind = 'purchase_request'`)[0].n;
      expect(after).toBe(before + 1);
      expect((await sql`select status from products where code = 'PLW-0002'`)[0].status).toBe("available");
    } finally {
      await sql.end();
    }
  });

  test("a question it cannot answer is passed on, not guessed", async ({ page }) => {
    await open(page);
    await expect(await say(page, "what is your refund policy")).toContainText("need to confirm that with the owner");
  });

  test("asking for a person highlights the WhatsApp route", async ({ page }) => {
    await open(page);
    await expect(page.getByTestId("chat-start")).toHaveClass(/border-whatsapp/);
    await expect(await say(page, "can I talk to a human")).toContainText("let the owner know");
    await expect(page.getByTestId("chat-start")).toHaveClass(/bg-whatsapp/);
  });

  test("a returning visitor sees the earlier conversation", async ({ page }) => {
    await open(page);
    await say(page, "do you have any anarkali");
    await expect(cards(page)).toHaveCount(3);
    await page.reload();
    await page.getByTestId("chat-launcher").click();
    await expect(page.getByTestId("chat-message-customer")).toHaveText("do you have any anarkali");
    await expect(cards(page)).toHaveCount(3);
    // Closing and reopening keeps it too.
    await page.keyboard.press("Escape");
    await page.getByTestId("chat-launcher").click();
    await expect(cards(page)).toHaveCount(3);
  });

  test("rejects requests that do not come from the site or are malformed", async ({ request, baseURL }) => {
    const bad = await request.post("/api/chat", { data: { message: "hi" }, headers: { origin: "https://evil.example" } });
    expect(bad.status()).toBe(403);
    expect((await request.post("/api/chat", { data: { message: "" }, headers: { origin: baseURL! } })).status()).toBe(400);
    expect((await request.post("/api/chat", { data: { message: "x".repeat(1001) }, headers: { origin: baseURL! } })).status()).toBe(400);
    expect((await request.post("/api/chat", { data: "not json", headers: { origin: baseURL!, "content-type": "application/json" } })).status()).toBe(400);
  });

  test("fits on the screen with a conversation in it", async ({ page }) => {
    await open(page, "/shop");
    await say(page, "do you have any anarkali");
    const viewport = page.viewportSize()!;
    const box = (await panel(page).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    await expect(page.getByTestId("chat-input")).toBeInViewport();
    await expect(page.getByTestId("chat-start")).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
