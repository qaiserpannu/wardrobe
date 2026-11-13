"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Items" },
  { href: "/admin/account", label: "Account" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto lg:flex-col" data-testid="admin-nav">
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
          </Link>
        );
      })}
    </nav>
  );
}
