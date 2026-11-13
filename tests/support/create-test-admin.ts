/**
 * Browser tests only: puts one known administrator into the TEST database.
 * These sign-in details exist nowhere else and open nothing real.
 */
import { TEST_ADMIN } from "./test-admin";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("wardrobe_test")) throw new Error("Refusing to create the test administrator outside the test database.");
  const { closeDb, getDb } = await import("@/server/db/client");
  const { adminUsers, loginAttempts } = await import("@/server/db/schema");
  const { createAdmin } = await import("@/server/services/admin-auth");
  await getDb().delete(adminUsers);
  await getDb().delete(loginAttempts);
  await createAdmin(TEST_ADMIN);
  await closeDb();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
