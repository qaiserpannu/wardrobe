import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { ArchMark } from "@/components/ui/Ornament";
import { getAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: "Sign in" };

/** Someone already signed in goes straight to the dashboard. */
async function RedirectIfSignedIn() {
  if (await getAdmin()) redirect("/admin");
  return null;
}

export default function LoginPage() {
  return (
    <main className="pattern-jali flex flex-1 items-center justify-center px-4 py-16">
      <Suspense>
        <RedirectIfSignedIn />
      </Suspense>
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 shadow-sm">
        <ArchMark className="mx-auto h-10 w-9 text-gold" />
        <h1 className="mt-4 text-center font-display text-3xl font-medium">Admin sign in</h1>
        <p className="mt-2 mb-7 text-center text-sm text-muted">For the shop owner only.</p>
        <LoginForm />
      </div>
    </main>
  );
}
