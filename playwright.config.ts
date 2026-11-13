import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://wardrobe:wardrobe@localhost:5432/wardrobe_test";
process.env.TEST_DATABASE_URL = TEST_DATABASE_URL;

/**
 * Browser tests. They load sample data into the test database, build the site,
 * start it on its own port, and then drive a real browser at phone, tablet and
 * desktop sizes.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "off" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1180 }, hasTouch: true } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run db:seed && npx tsx --conditions=react-server tests/support/create-test-admin.ts && npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      STORAGE_LOCAL_DIR: "./storage/test",
      SEED_WHATSAPP_NUMBER: "15555550100",
      // A fixed-rule stand-in for the AI model, so chat tests are repeatable and free.
      AI_PROVIDER: "test",
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
    },
  },
});
