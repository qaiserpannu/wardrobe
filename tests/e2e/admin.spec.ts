import { expect, type Page, test } from "@playwright/test";
import { TEST_ADMIN } from "../support/test-admin";

/** Milestone 5, part 1: signing in to the admin portal, the dashboard, and who is kept out. */

async function signIn(page: Page, password: string = TEST_ADMIN.password) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(TEST_ADMIN.email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("keeping strangers out", () => {
  test("the admin address sends a visitor to the sign-in page", async ({ page, request }) => {
    const response = await request.get("/admin", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain("/admin/login");
    expect(await response.text()).not.toContain("Welcome");

    await page.goto("/admin/account");
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByRole("heading", { name: "Admin sign in" })).toBeVisible();
  });

  test("an invented session cookie shows no admin information", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "plw_admin", value: "made-up-session-value", url: baseURL! }]);
    const html = await (await page.request.get("/admin")).text();
    expect(html).not.toContain("Welcome");
    expect(html).not.toContain(TEST_ADMIN.name);
    expect(html).not.toContain("status-counts");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("there is no sign-up page and the sign-in page offers none", async ({ page, request }) => {
    for (const path of ["/admin/register", "/admin/signup", "/register", "/signup"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect([307, 404], path).toContain(response.status());
    }
    await page.goto("/admin/login");
    await expect(page.getByRole("link", { name: /register|sign up|create account/i })).toHaveCount(0);
  });

  test("admin pages are hidden from search engines and are not linked from the shop", async ({ page }) => {
    const response = await page.goto("/admin/login");
    expect(response?.headers()["x-robots-tag"]).toContain("noindex");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    // The shop's header, footer and chat button are not part of the admin area.
    await expect(page.getByTestId("chat-launcher")).toHaveCount(0);
    await page.goto("/");
    await expect(page.locator('a[href^="/admin"]')).toHaveCount(0);
  });

  test("a wrong password gives one general message", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill("someone-else@test.invalid");
    await page.getByLabel("Password").fill("definitely-not-right");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByTestId("login-error")).toHaveText("The email or password is not correct.");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});

test.describe("the owner", () => {
  test("signs in, sees the dashboard, and signs out", async ({ page, context }) => {
    await signIn(page);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: `Welcome, ${TEST_ADMIN.name}` })).toBeVisible();

    // Sample data: 24 available, 2 on hold, 3 sold, 2 drafts, 1 archived.
    await expect(page.getByTestId("count-available")).toContainText("24");
    await expect(page.getByTestId("count-pending")).toContainText("2");
    await expect(page.getByTestId("count-sold")).toContainText("3");
    await expect(page.getByTestId("count-draft")).toContainText("2");
    await expect(page.getByTestId("count-archived")).toContainText("1");
    await expect(page.getByTestId("recent-products").getByRole("listitem")).toHaveCount(6);
    await expect(page.getByTestId("recent-activity")).toContainText(`${TEST_ADMIN.name} signed in`);

    // The session cookie cannot be read by scripts on the page.
    const cookie = (await context.cookies()).find((c) => c.name === "plw_admin");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    expect(await page.evaluate(() => document.cookie)).not.toContain("plw_admin");

    // Already signed in: the sign-in page goes straight back to the dashboard.
    await page.goto("/admin/login");
    await expect(page).toHaveURL(/\/admin$/);

    await page.getByTestId("logout").click();
    await expect(page).toHaveURL(/\/admin\/login$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);

    // The old cookie value no longer opens anything.
    await context.addCookies([{ ...cookie!, expires: -1 }]);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("changes the password, and the old one stops working", async ({ page }) => {
    const temporary = "temporary-password-for-test-7";
    await signIn(page);
    await page.getByTestId("admin-nav").getByRole("link", { name: "Account" }).click();
    await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
    const form = page.getByTestId("password-form");
    const message = page.getByTestId("password-message");

    await form.getByLabel("Current password").fill("not-the-current-one");
    await form.getByLabel("New password", { exact: true }).fill(temporary);
    await form.getByLabel("New password again").fill(temporary);
    await form.getByRole("button", { name: "Change password" }).click();
    await expect(message).toHaveText("The current password is not correct.");

    await form.getByLabel("Current password").fill(TEST_ADMIN.password);
    await form.getByLabel("New password", { exact: true }).fill("short");
    await form.getByLabel("New password again").fill("short");
    await form.getByRole("button", { name: "Change password" }).click();
    await expect(message).toContainText("at least 12");

    await form.getByLabel("Current password").fill(TEST_ADMIN.password);
    await form.getByLabel("New password", { exact: true }).fill(temporary);
    await form.getByLabel("New password again").fill(temporary);
    await form.getByRole("button", { name: "Change password" }).click();
    await expect(message).toContainText("Password changed");

    // Still signed in here; the old password no longer works; the new one does.
    await page.getByTestId("logout").click();
    await signIn(page);
    await expect(page.getByTestId("login-error")).toHaveText("The email or password is not correct.");
    await signIn(page, temporary);
    await expect(page).toHaveURL(/\/admin$/);

    // Put the original password back for the other tests.
    await page.goto("/admin/account");
    await page.getByLabel("Current password").fill(temporary);
    await page.getByLabel("New password", { exact: true }).fill(TEST_ADMIN.password);
    await page.getByLabel("New password again").fill(TEST_ADMIN.password);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByTestId("password-message")).toContainText("Password changed");
  });
});
