import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import { logoutAction } from "@/app/admin/actions";
import { getAdmin } from "@/server/auth/session";
import { AdminNav } from "./AdminNav";

async function SignedInAs() {
  const admin = await getAdmin();
  if (!admin) return null;
  return (
    <span className="truncate text-sm text-muted" data-testid="admin-user">
      {admin.name}
    </span>
  );
}

/** The frame around every admin page: title bar, menu, sign-out. */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <aside className="border-b border-line bg-surface lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="flex flex-col gap-3 px-4 py-4 lg:sticky lg:top-0 lg:gap-6 lg:px-5 lg:py-7">
          <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-start">
            <Link href="/admin" className="font-display text-xl font-semibold text-accent">
              Shop admin
            </Link>
            <Suspense>
              <SignedInAs />
            </Suspense>
          </div>
          {/* The current address is only known per request (dynamic item pages), so the menu streams in. */}
          <Suspense fallback={<div className="h-10 lg:h-36" />}>
            <AdminNav />
          </Suspense>
          <div className="flex items-center gap-4 text-sm lg:flex-col lg:items-start lg:gap-3 lg:border-t lg:border-line lg:pt-5">
            <a href="/" target="_blank" rel="noopener noreferrer" className="text-muted underline-offset-4 hover:text-accent hover:underline">
              View the website
            </a>
            <form action={logoutAction}>
              <button type="submit" className="text-muted underline-offset-4 hover:text-accent hover:underline" data-testid="logout">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main id="main" className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-10 lg:py-10">
        {children}
      </main>
    </div>
  );
}
