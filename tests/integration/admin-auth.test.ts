import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { hashPassword, passwordProblem, verifyPassword } from "@/server/auth/password";
import { closeDb, getDb } from "@/server/db/client";
import { adminSessions, adminUsers, auditLog } from "@/server/db/schema";
import {
  changePassword,
  clearLoginAttempts,
  createAdmin,
  getSessionUser,
  SESSION_IDLE_MS,
  setAdminPassword,
  signIn,
  signOut,
} from "@/server/services/admin-auth";

afterAll(async () => {
  await closeDb();
});

const PASSWORD = "a-long-test-password-1";
const newEmail = () => `admin-${randomUUID()}@test.invalid`;
const newAddress = () => `test-${randomUUID()}`;

async function newAdmin() {
  return createAdmin({ email: newEmail(), name: "Tester", password: PASSWORD });
}

describe("passwords", () => {
  it("are stored as a salted hash, never as the password", async () => {
    const one = await hashPassword(PASSWORD);
    const two = await hashPassword(PASSWORD);
    expect(one).not.toContain(PASSWORD);
    expect(one).not.toBe(two);
    expect(await verifyPassword(PASSWORD, one)).toBe(true);
    expect(await verifyPassword(PASSWORD + "x", one)).toBe(false);
    expect(await verifyPassword(PASSWORD, "not-a-hash")).toBe(false);
  });

  it("must be at least 12 characters", () => {
    expect(passwordProblem("short")).toMatch(/12/);
    expect(passwordProblem("aaaaaaaaaaaaaaaa")).toBeTruthy();
    expect(passwordProblem(PASSWORD)).toBeNull();
  });
});

describe("administrator accounts", () => {
  it("stores the email in lower case and refuses a second account with the same email", async () => {
    const email = newEmail();
    const admin = await createAdmin({ email: email.toUpperCase(), name: "Tester", password: PASSWORD });
    expect(admin.email).toBe(email);
    await expect(createAdmin({ email, name: "Other", password: PASSWORD })).rejects.toThrow();
  });

  it("refuses a weak password", async () => {
    await expect(createAdmin({ email: newEmail(), name: "Tester", password: "password" })).rejects.toThrow(/12/);
  });
});

describe("signing in", () => {
  it("accepts the right password and gives a working session", async () => {
    const admin = await newAdmin();
    const result = await signIn(admin.email.toUpperCase(), PASSWORD, newAddress());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await getSessionUser(result.token)).toEqual(admin);

    // Only a fingerprint of the cookie value is kept.
    const sessions = await getDb().select().from(adminSessions).where(eq(adminSessions.userId, admin.id));
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tokenHash).not.toBe(result.token);
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    const admin = await newAdmin();
    expect(await signIn(admin.email, "wrong-password-123", newAddress())).toEqual({ ok: false, reason: "invalid" });
    expect(await signIn(newEmail(), PASSWORD, newAddress())).toEqual({ ok: false, reason: "invalid" });
  });

  it("locks an address out of an account after five wrong passwords, even for the right one", async () => {
    const admin = await newAdmin();
    const address = newAddress();
    for (let i = 0; i < 5; i++) await signIn(admin.email, "wrong-password-123", address);
    expect(await signIn(admin.email, PASSWORD, address)).toEqual({ ok: false, reason: "locked" });
    // The owner, signing in from somewhere else, is not locked out by a stranger's five guesses.
    expect((await signIn(admin.email, PASSWORD, newAddress())).ok).toBe(true);
  });

  it("locks an account everywhere after thirty wrong passwords from many addresses", async () => {
    const admin = await newAdmin();
    for (let i = 0; i < 30; i++) await signIn(admin.email, "wrong-password-123", newAddress());
    expect(await signIn(admin.email, PASSWORD, newAddress())).toEqual({ ok: false, reason: "locked" });
    // Resetting the password with the setup command always lets the owner back in.
    await clearLoginAttempts(admin.email);
    expect((await signIn(admin.email, PASSWORD, newAddress())).ok).toBe(true);
  });

  it("locks an address after twenty wrong attempts across different emails", async () => {
    const admin = await newAdmin();
    const address = newAddress();
    for (let i = 0; i < 20; i++) await signIn(newEmail(), "wrong-password-123", address);
    expect(await signIn(admin.email, PASSWORD, address)).toEqual({ ok: false, reason: "locked" });
    expect((await signIn(admin.email, PASSWORD, newAddress())).ok).toBe(true);
  });

  it("records sign-ins and failures in the audit log without the password", async () => {
    const admin = await newAdmin();
    await signIn(admin.email, "wrong-password-123", newAddress());
    await signIn(admin.email, PASSWORD, newAddress());
    const rows = await getDb().select().from(auditLog).where(eq(auditLog.adminUserId, admin.id));
    expect(rows.map((r) => r.action).sort()).toEqual(["admin.created", "auth.login", "auth.login_failed"]);
    expect(JSON.stringify(rows)).not.toContain(PASSWORD);
    expect(JSON.stringify(rows)).not.toContain("wrong-password-123");
  });
});

describe("sessions", () => {
  async function session() {
    const admin = await newAdmin();
    const result = await signIn(admin.email, PASSWORD, newAddress());
    if (!result.ok) throw new Error("sign-in failed");
    return { admin, token: result.token };
  }

  it("rejects missing, invented and oversized cookie values", async () => {
    expect(await getSessionUser(undefined)).toBeNull();
    expect(await getSessionUser("")).toBeNull();
    expect(await getSessionUser("made-up-value")).toBeNull();
    expect(await getSessionUser("x".repeat(5000))).toBeNull();
  });

  it("end on sign-out", async () => {
    const { token } = await session();
    await signOut(token);
    expect(await getSessionUser(token)).toBeNull();
  });

  it("end at the expiry time", async () => {
    const { admin, token } = await session();
    await getDb().update(adminSessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(adminSessions.userId, admin.id));
    expect(await getSessionUser(token)).toBeNull();
  });

  it("end after a week without use", async () => {
    const { admin, token } = await session();
    await getDb()
      .update(adminSessions)
      .set({ lastSeenAt: new Date(Date.now() - SESSION_IDLE_MS - 1000) })
      .where(eq(adminSessions.userId, admin.id));
    expect(await getSessionUser(token)).toBeNull();
  });

  it("end when the account is removed", async () => {
    const { admin, token } = await session();
    await getDb().delete(adminUsers).where(eq(adminUsers.id, admin.id));
    expect(await getSessionUser(token)).toBeNull();
  });
});

describe("changing the password", () => {
  it("needs the current password, then signs out other browsers but not this one", async () => {
    const admin = await newAdmin();
    const here = await signIn(admin.email, PASSWORD, newAddress());
    const elsewhere = await signIn(admin.email, PASSWORD, newAddress());
    if (!here.ok || !elsewhere.ok) throw new Error("sign-in failed");

    expect(await changePassword(admin, "wrong-password-123", "another-long-password-2", here.token)).toMatchObject({ ok: false });
    expect(await changePassword(admin, PASSWORD, "short", here.token)).toMatchObject({ ok: false });
    expect(await changePassword(admin, PASSWORD, PASSWORD, here.token)).toMatchObject({ ok: false });
    expect((await signIn(admin.email, PASSWORD, newAddress())).ok).toBe(true);

    expect(await changePassword(admin, PASSWORD, "another-long-password-2", here.token)).toEqual({ ok: true });
    expect(await getSessionUser(here.token)).toEqual(admin);
    expect(await getSessionUser(elsewhere.token)).toBeNull();
    expect((await signIn(admin.email, PASSWORD, newAddress())).ok).toBe(false);
    expect((await signIn(admin.email, "another-long-password-2", newAddress())).ok).toBe(true);
  });

  it("a reset from the setup script signs out every browser", async () => {
    const admin = await newAdmin();
    const result = await signIn(admin.email, PASSWORD, newAddress());
    if (!result.ok) throw new Error("sign-in failed");
    await setAdminPassword(admin.id, "reset-by-script-password-3");
    expect(await getSessionUser(result.token)).toBeNull();
  });
});
