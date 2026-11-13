"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { PASSWORD_MAX_LENGTH } from "@/server/auth/password";
import {
  clearSessionCookie,
  clientAddress,
  LOGIN_PATH,
  readSessionToken,
  requireAdmin,
  setSessionCookie,
} from "@/server/auth/session";
import { changePassword, signIn, signOut } from "@/server/services/admin-auth";
import { recordAudit } from "@/server/services/audit";

export type FormState = { error?: string; success?: string };

const loginSchema = z.object({
  email: z.string().trim().min(3).max(200),
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

export async function loginAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter your email and password." };

  const result = await signIn(parsed.data.email, parsed.data.password, await clientAddress());
  if (!result.ok) {
    return {
      error:
        result.reason === "locked"
          ? "Too many attempts. Please wait 15 minutes and try again."
          : "The email or password is not correct.",
    };
  }
  await setSessionCookie(result.token);
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  const admin = await requireAdmin();
  await signOut(await readSessionToken());
  await clearSessionCookie();
  await recordAudit({ adminUserId: admin.id, action: "auth.logout", summary: `${admin.name} signed out` });
  redirect(LOGIN_PATH);
}

const passwordSchema = z.object({
  current: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  next: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  confirm: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

export async function changePasswordAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const token = await readSessionToken();
  const parsed = passwordSchema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success || !token) return { error: "Fill in all three boxes." };
  if (parsed.data.next !== parsed.data.confirm) return { error: "The two new passwords do not match." };

  const result = await changePassword(admin, parsed.data.current, parsed.data.next, token);
  if (!result.ok) return { error: result.error };
  return { success: "Password changed. Other browsers signed in to this account have been signed out." };
}
