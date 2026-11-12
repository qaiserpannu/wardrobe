import { migrate } from "drizzle-orm/postgres-js/migrator";
import { closeDb, getDb } from "./client";

export async function runMigrations() {
  await migrate(getDb(), { migrationsFolder: "./src/server/db/migrations" });
}

if (process.argv[1]?.endsWith("migrate.ts")) {
  runMigrations()
    .then(() => console.log("Database is up to date."))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(closeDb);
}
