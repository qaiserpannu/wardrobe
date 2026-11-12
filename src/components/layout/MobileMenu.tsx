"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";

type NavLink = { href: string; label: string; children?: { href: string; label: string }[] };

/** Closes the menu whenever the visitor lands on a new page or filter. */
function CloseOnNavigate({ onNavigate }: { onNavigate: () => void }) {
  const location = `${usePathname()}?${useSearchParams().toString()}`;
  const previous = useRef(location);
  useEffect(() => {
    // Only react to a real change of address, not to this component first appearing.
    if (previous.current !== location) {
      previous.current = location;
      onNavigate();
    }
  }, [location, onNavigate]);
  return null;
}

export function MobileMenu({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const [close] = useState(() => () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <Suspense fallback={null}>
        <CloseOnNavigate onNavigate={close} />
      </Suspense>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((v) => !v)}
        className="-ml-2 flex size-11 items-center justify-center rounded-full"
      >
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>
      <nav
        id="mobile-menu"
        aria-label="Mobile"
        hidden={!open}
        className="absolute inset-x-0 top-full z-40 max-h-[calc(100dvh-7rem)] overflow-y-auto border-b border-line bg-canvas shadow-lg"
      >
        <ul className="flex flex-col px-4 py-2">
          {links.map((link) => (
            <li key={link.href} className="border-b border-line last:border-0">
              <Link
                href={link.href}
                onClick={close}
                className={`block py-3.5 text-base ${link.children?.length ? "font-semibold text-accent" : ""}`}
              >
                {link.label}
              </Link>
              {link.children && link.children.length > 0 && (
                <ul className="-mt-1 grid grid-cols-2 gap-x-4 pb-3 pl-3">
                  {link.children.map((child) => (
                    <li key={child.href}>
                      <Link href={child.href} onClick={close} className="block py-2 text-[0.95rem] text-muted">
                        {child.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
