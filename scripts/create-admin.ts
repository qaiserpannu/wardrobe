/**
 * Creates the administrator account, or resets its password. This is the ONLY
 * way an admin account comes into existence: there is no sign-up page.
 *
 *   npm run admin:create
 *
 * It asks for the name, email and password in the terminal. The password is
 * not shown while typing, is never written to a file, and is stored only as a
 * salted hash.
 */
import { createInterface } from "node:readline";
import { Writable } from "node:stream";

let muted = false;
const output = new Writable({
  write(chunk, encoding, done) {
    if (!muted) process.stdout.write(chunk, encoding as BufferEncoding);
    done();
  },
});
const interactive = Boolean(process.stdin.isTTY);
const rl = createInterface({ input: process.stdin, output, terminal: interactive });

// When answers are piped in (automated tests), lines can arrive before they are asked for.
const lines = rl[Symbol.asyncIterator]();

async function ask(question: string, hidden = false): Promise<string> {
  process.stdout.write(question);
  muted = hidden && interactive;
  const next = await lines.next();
  muted = false;
  if (hidden && interactive) process.stdout.write("\n");
  if (next.done) throw new Error("Input ended before all questions were answered.");
  return next.value.trim();
}

async function main() {
  const { closeDb } = await import("@/server/db/client");
  const { clearLoginAttempts, createAdmin, findAdminByEmail, setAdminPassword } = await import("@/server/services/admin-auth");
  const { passwordProblem } = await import("@/server/auth/password");
  const { recordAudit } = await import("@/server/services/audit");

  try {
    console.log("\nPre-Loved Wardrobe: administrator setup\n");
    const email = await ask("Email address: ");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) throw new Error("That does not look like an email address.");

    const existing = await findAdminByEmail(email);
    let name = existing?.name ?? "";
    if (existing) {
      const answer = await ask(`An administrator with this email already exists (${existing.name}). Reset the password? (yes/no): `);
      if (answer.toLowerCase() !== "yes") {
        console.log("Nothing was changed.");
        return;
      }
    } else {
      name = await ask("Your name (shown in the admin portal): ");
      if (!name || name.length > 80) throw new Error("Please enter a name of up to 80 characters.");
    }

    const password = await ask("Password (at least 12 characters; not shown while typing): ", true);
    const problem = passwordProblem(password);
    if (problem) throw new Error(problem);
    const again = await ask("Password again: ", true);
    if (password !== again) throw new Error("The two passwords did not match. Nothing was changed.");

    if (existing) {
      await setAdminPassword(existing.id, password);
      await clearLoginAttempts(existing.email);
      await recordAudit({
        adminUserId: existing.id,
        action: "auth.password_reset",
        summary: `Password for ${existing.email} reset by the setup script`,
      });
      console.log(`\nPassword reset for ${existing.email}. Any open admin sessions were signed out.`);
    } else {
      const admin = await createAdmin({ email, name, password });
      console.log(`\nAdministrator created: ${admin.email}. Sign in at /admin.`);
    }
  } finally {
    rl.close();
    await closeDb();
  }
}

main().catch((error) => {
  console.error(`\nCould not finish: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
