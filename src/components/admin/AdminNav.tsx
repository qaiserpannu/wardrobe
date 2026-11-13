"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/inbox", label: "Inbox" },
  { href: "/admin/products", label: "Items" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/assistant", label: "Assistant" },
  { href: "/admin/activity", label: "Activity" },
  { href: "/admin/account", label: "Account" },
] as const;

export function AdminNav({ waiting = 0 }: { waiting?: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex flex-wrap gap-1 lg:flex-col lg:flex-nowrap" data-testid="admin-nav">
      {LINKS.map((link) => {
        const active = link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
              active ? "bg-accent text-white" : "text-ink hover:bg-sand"
            }`}
          >
            {link.label}
            {link.href === "/admin/inbox" && waiting > 0 && (
              <span
                className={`ml-2 inline-flex min-w-5 justify-center rounded-full px-1.5 text-xs font-semibold ${active ? "bg-white text-accent" : "bg-accent text-white"}`}
                data-testid="inbox-badge"
              >
                {waiting}
                <span className="sr-only"> waiting for you</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
