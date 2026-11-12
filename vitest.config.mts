import path from "node:path";
import { defineConfig } from "vitest/config";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://wardrobe:wardrobe@localhost:5432/wardrobe_test";

// Tests always use the separate test database and image folder, never the development ones.
const env = {
  DATABASE_URL: TEST_DATABASE_URL,
  STORAGE_LOCAL_DIR: "./storage/test",
  SEED_WHATSAPP_NUMBER: "15555550100",
};
Object.assign(process.env, env);

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // "server-only" throws outside Next.js; tests run the server code directly.
      "server-only": path.resolve(import.meta.dirname, "tests/support/empty.ts"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    globalSetup: ["tests/support/global-setup.ts"],
    fileParallelism: false,
    env,
  },
});
