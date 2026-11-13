import type { Metadata } from "next";
import { Suspense } from "react";
import { ChangePasswordForm } from "@/components/admin/ChangePasswordForm";
import { PageHeading } from "@/components/admin/PageHeading";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: "Account" };

async function Account() {
  const admin = await requireAdmin();
  return (
    <>
      <PageHeading title="Account">
        Signed in as {admin.name} ({admin.email}).
      </PageHeading>
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="mb-5 font-display text-2xl font-medium">Change password</h2>
        <ChangePasswordForm />
      </section>
    </>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Account />
    </Suspense>
  );
}
