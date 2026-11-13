import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt, ne, sql } from "drizzle-orm";
import { hashPassword, passwordProblem, verifyPassword } from "@/server/auth/password";
import { getDb } from "@/server/db/client";
import { adminSessions, adminUsers, loginAttempts } from "@/server/db/schema";
import { recordAudit } from "./audit";

/**
 * Admin accounts and sign-in. There is deliberately no "register" function
 * reachable from the website: accounts are created only by the setup script
 * (scripts/create-admin.ts), run by someone with access to the server.
 */

export type AdminUser = { id: string; email: string; name: string };

/** A session ends after this long without use... */
export const SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1000;
/** ...and in any case this long after signing in. */
export const SESSION_MAX_MS = 30 * 24 * 60 * 60 * 1000;

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_ADDRESS = 20;

/** Used to spend the same time on an unknown email as on a wrong password. */
let decoyHash: Promise<string> | undefined;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function countAdmins(): Promise<number> {
  const [row] = await getDb().select({ n: sql<number>`count(*)::int` }).from(adminUsers);
  return row?.n ?? 0;
}

export async function findAdminByEmail(email: string): Promise<AdminUser | null> {
  const [row] = await getDb()
    .select({ id: adminUsers.id, email: adminUsers.email, name: adminUsers.name })
    .from(adminUsers)
    .where(eq(adminUsers.email, normalizeEmail(email)));
  return row ?? null;
}

/** Setup script only. Throws if the password is too weak or the email is taken. */
export async function createAdmin(input: { email: string; name: string; password: string }): Promise<AdminUser> {
  const problem = passwordProblem(input.password);
  if (problem) throw new Error(problem);
  const email = normalizeEmail(input.email);
  const [row] = await getDb()
    .insert(adminUsers)
    .values({ email, name: input.name.trim(), passwordHash: await hashPassword(input.password) })
    .returning({ id: adminUsers.id, email: adminUsers.email, name: adminUsers.name });
  await recordAudit({ adminUserId: row.id, action: "admin.created", summary: `Administrator ${email} created by the setup script` });
  return row;
}

/** Sets a new password and signs the account out everywhere (optionally keeping one session). */
export async function setAdminPassword(userId: string, password: string, keepSessionToken?: string): Promise<void> {
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  const db = getDb();
  await db.update(adminUsers).set({ passwordHash: await hashPassword(password) }).where(eq(adminUsers.id, userId));
  await db
    .delete(adminSessions)
    .where(
      keepSessionToken
        ? and(eq(adminSessions.userId, userId), ne(adminSessions.tokenHash, hashToken(keepSessionToken)))
        : eq(adminSessions.userId, userId),
    );
}

async function recentFailures(subject: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.subject, subject), gt(loginAttempts.createdAt, new Date(Date.now() - ATTEMPT_WINDOW_MS))));
  return row?.n ?? 0;
}

export type LoginResult =
  | { ok: true; user: AdminUser; token: string; expiresAt: Date }
  | { ok: false; reason: "invalid" | "locked" };

/**
 * Checks an email and password. After too many wrong attempts for one email
 * or from one address, further attempts are refused for 15 minutes, even with
 * the right password.
 */
export async function signIn(emailInput: string, password: string, address: string): Promise<LoginResult> {
  const db = getDb();
  const email = normalizeEmail(emailInput);
  const subjects = [`email:${email}`, `ip:${address}`];

  const [byEmail, byAddress] = await Promise.all(subjects.map(recentFailures));
  if (byEmail >= MAX_FAILURES_PER_EMAIL || byAddress >= MAX_FAILURES_PER_ADDRESS) {
    return { ok: false, reason: "locked" };
  }

  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.email, email));
  decoyHash ??= hashPassword(randomBytes(18).toString("base64"));
  const matches = await verifyPassword(password, user?.passwordHash ?? (await decoyHash));

  if (!user || !matches) {
    await db.insert(loginAttempts).values(subjects.map((subject) => ({ subject })));
    await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
    await recordAudit({ adminUserId: user?.id ?? null, action: "auth.login_failed", summary: "Failed sign-in attempt" });
    return { ok: false, reason: "invalid" };
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_MAX_MS);
  await db.insert(adminSessions).values({ userId: user.id, tokenHash: hashToken(token), expiresAt });
  await db.update(adminUsers).set({ lastLoginAt: new Date() }).where(eq(adminUsers.id, user.id));
  await db.delete(loginAttempts).where(eq(loginAttempts.subject, `email:${email}`));
  await db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date()));
  await recordAudit({ adminUserId: user.id, action: "auth.login", summary: `${user.name} signed in` });
  return { ok: true, user: { id: user.id, email: user.email, name: user.name }, token, expiresAt };
}

/** The signed-in administrator for a cookie value, or null if it is unknown, expired or idle too long. */
export async function getSessionUser(token: string | undefined): Promise<AdminUser | null> {
  if (!token || token.length > 200) return null;
  const db = getDb();
  const now = new Date();
  const [row] = await db
    .select({
      sessionId: adminSessions.id,
      lastSeenAt: adminSessions.lastSeenAt,
      id: adminUsers.id,
      email: adminUsers.email,
      name: adminUsers.name,
    })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminSessions.userId, adminUsers.id))
    .where(
      and(
        eq(adminSessions.tokenHash, hashToken(token)),
        gt(adminSessions.expiresAt, now),
        gt(adminSessions.lastSeenAt, new Date(now.getTime() - SESSION_IDLE_MS)),
      ),
    );
  if (!row) return null;
  if (now.getTime() - row.lastSeenAt.getTime() > 5 * 60 * 1000) {
    await db.update(adminSessions).set({ lastSeenAt: now }).where(eq(adminSessions.id, row.sessionId));
  }
  return { id: row.id, email: row.email, name: row.name };
}

export async function signOut(token: string | undefined): Promise<void> {
  if (!token) return;
  await getDb().delete(adminSessions).where(eq(adminSessions.tokenHash, hashToken(token)));
}

/** Changes the password after re-checking the current one. Other browsers are signed out. */
export async function changePassword(
  user: AdminUser,
  currentPassword: string,
  newPassword: string,
  sessionToken: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [row] = await getDb().select({ hash: adminUsers.passwordHash }).from(adminUsers).where(eq(adminUsers.id, user.id));
  if (!row || !(await verifyPassword(currentPassword, row.hash))) {
    return { ok: false, error: "The current password is not correct." };
  }
  const problem = passwordProblem(newPassword);
  if (problem) return { ok: false, error: problem };
  if (newPassword === currentPassword) return { ok: false, error: "The new password must be different from the current one." };
  await setAdminPassword(user.id, newPassword, sessionToken);
  await recordAudit({ adminUserId: user.id, action: "auth.password_changed", summary: `${user.name} changed their password` });
  return { ok: true };
}
