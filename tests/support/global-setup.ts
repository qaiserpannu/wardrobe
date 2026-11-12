/** Loads fresh sample data into the test database once before the test run. */
export default async function setup() {
  const { seed } = await import("@/server/db/seed");
  const { closeDb } = await import("@/server/db/client");
  await seed();
  await closeDb();
}
