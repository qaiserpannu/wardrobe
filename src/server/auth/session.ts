import "server-only";
import { cache } from "react";
import { io } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { type AdminUser, getSessionUser, SESSION_MAX_MS } from "@/server/services/admin-auth";

/**
 * The admin session cookie. It holds a random value that means nothing on its
 * own; the matching record lives in the database. JavaScript in the browser
 * cannot read it (httpOnly) and other websites cannot send it (sameSite).
 */
export const ADMIN_COOKIE = "plw_admin";
export const LOGIN_PATH = "/admin/login";

export async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(ADMIN_COOKIE)?.value;
}

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_MAX_MS / 1000),
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}

/** The signed-in administrator, or null. Looked up once per request. */
export const getAdmin = cache(async (): Promise<AdminUser | null> => {
  const token = await readSessionToken();
  // The session check depends on the current time, so it always runs at request time.
  await io();
  return getSessionUser(token);
});

/**
 * Call at the top of every admin page, admin action and admin API. Sends
 * anyone who is not signed in to the login page.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) redirect(LOGIN_PATH);
  return admin;
}

/** Best guess at the visitor's network address, for slowing down password guessing. */
export async function clientAddress(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
