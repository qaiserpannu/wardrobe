"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const SEEN_KEY = "plw_visit";

function send(body: Record<string, unknown>) {
  try {
    const data = JSON.stringify(body);
    if (navigator.sendBeacon?.("/api/visit", new Blob([data], { type: "text/plain" }))) return;
    void fetch("/api/visit", { method: "POST", body: data, keepalive: true }).catch(() => {});
  } catch {
    // Counting is best-effort and must never disturb the page.
  }
}

/**
 * Tells the site that a public page was viewed, and when a WhatsApp button is
 * tapped, so the owner can see visitor counts (D48). Sets no cookie. Renders nothing.
 */
export function VisitBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    let entry = false;
    try {
      entry = !sessionStorage.getItem(SEEN_KEY);
      if (entry) sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Private browsing can refuse storage; every page then counts as a new visit.
      entry = true;
    }
    send({
      kind: "view",
      url: pathname + window.location.search,
      entry,
      ...(entry && document.referrer ? { referrer: document.referrer.slice(0, 600) } : {}),
    });
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest('a[href^="https://wa.me/"]') : null;
      if (link) send({ kind: "whatsapp", url: window.location.pathname });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
