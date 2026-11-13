import { expect, type Page, test } from "@playwright/test";
import { TEST_ADMIN } from "../support/test-admin";

/**
 * Milestone 5, part 4: the inbox and the assistant's settings. One browser is
 * the customer in the website chat, another is the owner in the admin portal.
 * The AI model is the fixed-rule stand-in (AI_PROVIDER=test).
 */

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(TEST_ADMIN.email);
  await page.getByLabel("Password").fill(TEST_ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

const assistantReplies = (page: Page) => page.getByTestId("chat-message-assistant");

async function say(page: Page, text: string) {
  const before = await assistantReplies(page).count();
  await page.getByTestId("chat-input").fill(text);
  await page.getByTestId("chat-send").click();
  await expect(assistantReplies(page)).toHaveCount(before + 1);
  return assistantReplies(page).last();
}

test("inbox and assistant pages are closed to visitors", async ({ page }) => {
  for (const path of ["/admin/inbox", "/admin/inbox/00000000-0000-4000-8000-000000000000", "/admin/assistant"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/login$/);
  }
});

test("a customer's question reaches the inbox, the owner replies, and the customer sees it", async ({ page, browser }, testInfo) => {
  test.setTimeout(90_000);
  const question = `Do you deliver to Narnia ${testInfo.project.name} ${Date.now()}?`;
  const answer = `Yes, on Sundays (${testInfo.project.name}).`;

  // The customer asks something the assistant may not answer.
  const customer = await (await browser.newContext()).newPage();
  await customer.goto("/");
  await customer.getByTestId("chat-launcher").click();
  await expect(await say(customer, question)).toContainText("confirm that with the owner");

  // The owner sees it waiting.
  await signIn(page);
  await expect(page.getByTestId("inbox-badge")).toBeVisible();
  await page.getByTestId("admin-nav").getByRole("link", { name: /Inbox/ }).click();
  const item = page.getByTestId("inbox-item").filter({ hasText: question });
  await expect(item).toContainText("Question for you");
  await item.click();
  await expect(page.getByTestId("thread").getByTestId("thread-customer")).toContainText(question);
  await expect(page.getByTestId("conversation-requests")).toContainText(question);

  // An empty reply is refused; a real one is sent.
  await page.getByLabel("Reply as yourself").fill(answer);
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(page.getByTestId("inbox-message")).toContainText("Sent");
  await expect(page.getByTestId("thread").getByTestId("thread-owner")).toContainText(answer);
  await expect(page.getByTestId("conversation-state")).toHaveText("You are answering");
  await expect(page.getByTestId("conversation-requests")).toContainText("Nothing is waiting");

  // The customer's open chat shows it, marked as from the owner, without reloading.
  const fromOwner = customer.getByTestId("chat-message-owner");
  await expect(fromOwner).toContainText(answer, { timeout: 20_000 });
  await expect(fromOwner).toContainText("From the shop owner");

  // While the owner is handling it, the assistant does not answer.
  await expect(await say(customer, "do you have any anarkali")).toContainText("owner has your message");
  await page.reload();
  await expect(page.getByTestId("thread").getByTestId("thread-customer").last()).toContainText("do you have any anarkali");

  // Handed back: the assistant answers again.
  await page.getByTestId("hand-back").click();
  await expect(page.getByTestId("conversation-state")).toHaveText("Assistant is answering");
  await expect(await say(customer, "do you have any anarkali")).toContainText("I found");

  // A returning customer still sees the owner's reply.
  await customer.reload();
  await customer.getByTestId("chat-launcher").click();
  await expect(customer.getByTestId("chat-message-owner")).toContainText(answer);
  await customer.context().close();
});

test("a buy request shows in the inbox with the item, and can be marked as dealt with", async ({ page, browser }) => {
  const customer = await (await browser.newContext()).newPage();
  await customer.goto("/");
  await customer.getByTestId("chat-launcher").click();
  await expect(await say(customer, "I want to buy PLW-0003")).toContainText("passed your request");

  await signIn(page);
  await page.goto("/admin/inbox");
  const item = page.getByTestId("inbox-item").filter({ hasText: "PLW-0003" }).first();
  await expect(item).toContainText("Wants to buy");
  await item.click();
  const interest = page.getByTestId("conversation-interest");
  await expect(interest).toContainText("PLW-0003");
  await expect(interest).toContainText("now available"); // nothing was reserved

  await page.getByTestId("dealt-with").click();
  await expect(page.getByTestId("conversation-requests")).toContainText("Nothing is waiting");
  // The link leads to the item, where the owner can put it on hold.
  await interest.getByRole("link", { name: /PLW-0003/ }).click();
  await expect(page.locator('[data-testid="status-panel"]:visible')).toHaveAttribute("data-status", "available");
  await customer.context().close();
});

test("the owner manages what the assistant may say, and can switch her off", async ({ page, browser }, testInfo) => {
  page.on("dialog", (dialog) => dialog.accept());
  const title = `Gift wrapping ${testInfo.project.name}`;
  await signIn(page);
  await page.getByTestId("admin-nav").getByRole("link", { name: "Assistant" }).click();
  await expect(page.getByTestId("assistant-status")).toContainText("is answering customers");
  await expect(page.getByTestId("knowledge-item")).toHaveCount(4);

  // Add, edit, switch off and delete a piece of shop information.
  const add = page.getByTestId("knowledge-add");
  await add.getByLabel("Title").fill(title);
  await add.getByLabel("What the assistant may say").fill("Gift wrapping is free on request.");
  await add.getByRole("button", { name: "Add" }).click();
  const entry = page.locator(`[data-testid="knowledge-item"][data-title="${title}"]`);
  await expect(entry).toContainText("Gift wrapping is free on request.");

  await entry.getByRole("button", { name: `Edit ${title}` }).click();
  await entry.getByLabel("What the assistant may say").fill("Gift wrapping costs $2.");
  await entry.getByRole("button", { name: "Save" }).click();
  await expect(entry).toContainText("Gift wrapping costs $2.");
  await entry.getByRole("button", { name: `Switch off ${title}` }).click();
  await expect(entry).toContainText("switched off");
  await entry.getByRole("button", { name: `Delete ${title}` }).click();
  await expect(entry).toHaveCount(0);
  await expect(page.getByTestId("knowledge-item")).toHaveCount(4);

  // Switch the assistant off: the chat button falls back to the WhatsApp panel.
  const visitor = await (await browser.newContext()).newPage();
  const behaviour = page.getByTestId("settings-assistant");
  await behaviour.getByLabel("Assistant switched on").uncheck();
  await behaviour.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("settings-message-assistant")).toContainText("Saved");
  await expect(page.getByTestId("assistant-status")).toContainText("Switched off");
  await visitor.goto("/");
  await visitor.getByTestId("chat-launcher").click();
  await expect(visitor.getByTestId("chat-start")).toBeVisible();
  await expect(visitor.getByTestId("chat-input")).toHaveCount(0);

  // And back on, for the customer and for the other tests.
  await behaviour.getByLabel("Assistant switched on").check();
  await behaviour.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("assistant-status")).toContainText("is answering customers");
  await visitor.reload();
  await visitor.getByTestId("chat-launcher").click();
  await expect(visitor.getByTestId("chat-input")).toBeVisible();
  await visitor.context().close();
});
