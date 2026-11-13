import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";
import { TEST_ADMIN } from "../support/test-admin";

/** Milestone 5, part 3: settings and categories, and that the website follows at once. */

const ANNOUNCEMENT = "Every piece is one of a kind · New arrivals weekly";
const TEST_NUMBER = "15555550100";
const createdCategories: string[] = [];

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(TEST_ADMIN.email);
  await page.getByLabel("Password").fill(TEST_ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

// Categories cannot be deleted from the portal (by design). The test hides its
// own, then they are removed here so other tests see only the sample data.
test.afterAll(async () => {
  if (createdCategories.length === 0) return;
  const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 1 });
  await sql`delete from categories where name in ${sql(createdCategories)} and parent_id is not null`;
  await sql`delete from categories where name in ${sql(createdCategories)}`;
  await sql.end();
});

test("settings and category pages are closed to visitors", async ({ page, request, baseURL }) => {
  for (const path of ["/admin/settings", "/admin/categories"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/login$/);
  }
  const response = await request.post("/api/admin/settings/hero-image", {
    headers: { origin: baseURL! },
    multipart: { file: { name: "a.jpg", mimeType: "image/jpeg", buffer: Buffer.from("x") } },
  });
  expect(response.status()).toBe(401);
});

test("a settings change shows on the website straight away", async ({ page, browser }) => {
  const visitor = await (await browser.newContext()).newPage();
  await signIn(page);
  await page.getByTestId("admin-nav").getByRole("link", { name: "Settings" }).click();

  // The strip above the header.
  const branding = page.getByTestId("settings-branding");
  await branding.getByLabel("Strip above the header").fill("Eid collection is here");
  await branding.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("settings-message-branding")).toContainText("Saved");
  await visitor.goto("/");
  await expect(visitor.getByText("Eid collection is here")).toBeVisible();

  // The WhatsApp number, typed the way a person would.
  const whatsapp = page.getByTestId("settings-whatsapp");
  await whatsapp.getByLabel("WhatsApp number").fill("(813) 555-0142");
  await whatsapp.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("settings-message-whatsapp")).toContainText("Saved");
  await expect(whatsapp.getByLabel("WhatsApp number")).toHaveValue("18135550142");
  await visitor.goto("/shop/teal-embroidered-lawn-suit-plw-0001");
  await expect(visitor.getByRole("link", { name: /Ask about this item on WhatsApp/ })).toHaveAttribute("href", /wa\.me\/18135550142\?/);

  // A mistake is explained and what was typed is kept.
  const contact = page.getByTestId("settings-contact");
  await contact.getByLabel("Email").fill("not-an-email");
  await contact.getByLabel("Location").fill("Tampa, Florida");
  await contact.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("error-contact__email")).toBeVisible();
  await expect(contact.getByLabel("Location")).toHaveValue("Tampa, Florida");
  await expect(contact.getByLabel("Email")).toHaveValue("not-an-email");

  // Put the sample values back for the other tests.
  await page.reload();
  await page.getByTestId("settings-branding").getByLabel("Strip above the header").fill(ANNOUNCEMENT);
  await page.getByTestId("settings-branding").getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("settings-message-branding")).toContainText("Saved");
  await page.getByTestId("settings-whatsapp").getByLabel("WhatsApp number").fill(TEST_NUMBER);
  await page.getByTestId("settings-whatsapp").getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("settings-message-whatsapp")).toContainText("Saved");
  await visitor.goto("/");
  await expect(visitor.getByText(ANNOUNCEMENT)).toBeVisible();
  await visitor.context().close();
});

test("categories can be added, renamed, hidden and shown, and the shop follows", async ({ page, browser }, testInfo) => {
  const visitor = await (await browser.newContext()).newPage();
  page.on("dialog", (dialog) => dialog.accept());
  const groupName = `Kids ${testInfo.project.name}`;
  const childName = `Frocks ${testInfo.project.name}`;
  const renamed = `Party Frocks ${testInfo.project.name}`;
  createdCategories.push(groupName, childName, renamed);

  await signIn(page);
  await page.getByTestId("admin-nav").getByRole("link", { name: "Categories" }).click();
  const manager = page.getByTestId("category-manager");
  await expect(manager.getByTestId("category-group")).toHaveCount(4);

  // A duplicate name is refused with an explanation.
  await manager.getByTestId("add-group").getByLabel("New group name").fill("Sarees");
  await manager.getByTestId("add-group").getByRole("button", { name: "Add" }).click();
  await expect(page.getByTestId("category-error")).toContainText("already a category");

  // New group, a category inside it, and a rename.
  await manager.getByTestId("add-group").getByLabel("New group name").fill(groupName);
  await manager.getByTestId("add-group").getByRole("button", { name: "Add" }).click();
  const group = manager.locator(`[data-testid="category-group"][data-name="${groupName}"]`);
  await expect(group).toBeVisible();
  await group.getByLabel(`New category in ${groupName}`).fill(childName);
  await group.getByRole("button", { name: "Add" }).click();
  await expect(group.locator(`[data-testid="category-row"][data-name="${childName}"]`)).toBeVisible();
  await group.getByRole("button", { name: `Rename ${childName}` }).click();
  await group.getByLabel(`New name for ${childName}`).fill(renamed);
  await group.getByRole("button", { name: "Save" }).click();
  await expect(group.locator(`[data-testid="category-row"][data-name="${renamed}"]`)).toBeVisible();

  // The new group is in the shop's footer at once.
  await visitor.goto("/");
  await expect(visitor.locator("footer").getByRole("link", { name: groupName })).toBeVisible();

  // Hiding it removes it again.
  await group.getByRole("button", { name: `Hide ${groupName}` }).click();
  await expect(group.getByRole("button", { name: `Show ${groupName}` })).toBeVisible();
  await visitor.reload();
  await expect(visitor.locator("footer").getByRole("link", { name: groupName })).toHaveCount(0);

  // Hiding a category with items takes those items off the website, and showing brings them back.
  const sarees = visitor.locator('footer a[href="/shop?category=sarees"]');
  await expect(sarees).toHaveCount(1);
  await manager.getByRole("button", { name: "Hide Sarees" }).click();
  await expect(manager.getByRole("button", { name: "Show Sarees" })).toBeVisible();
  await visitor.reload();
  await expect(sarees).toHaveCount(0);
  await visitor.goto("/shop?category=sarees");
  await expect(visitor.getByTestId("result-count")).toHaveText("0 items");

  await manager.getByRole("button", { name: "Show Sarees" }).click();
  await expect(manager.getByRole("button", { name: "Hide Sarees" })).toBeVisible();
  await visitor.reload();
  await expect(visitor.getByTestId("result-count")).not.toHaveText("0 items");
  await expect(sarees).toHaveCount(1);

  // Reordering: move the second group up and back.
  const names = () => manager.getByTestId("category-group").evaluateAll((els) => els.map((el) => el.getAttribute("data-name")));
  const before = await names();
  await manager.getByRole("button", { name: `Move ${before[1]} up` }).click();
  await expect.poll(names).toEqual([before[1], before[0], ...before.slice(2)]);
  await manager.getByRole("button", { name: `Move ${before[1]} down` }).click();
  await expect.poll(names).toEqual(before);
  await visitor.context().close();
});
