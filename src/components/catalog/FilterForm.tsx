"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { FilterIcon } from "@/components/ui/icons";

type Props = {
  children: ReactNode;
  activeCount: number;
  /** Changes whenever the filters in the URL change. */
  urlKey: string;
};

/**
 * Wraps the filter controls. Works as a plain form without JavaScript; with
 * JavaScript it applies filters as soon as a box is ticked and keeps the URL tidy.
 */
export function FilterForm({ children, activeCount, urlKey }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // When the URL changes from outside this form (a filter chip removed, "Clear
  // all", the back button) the inputs are rebuilt so they match the URL again.
  // Changes the visitor makes in the form itself keep the inputs as they are,
  // so focus is not lost while ticking several boxes.
  const [seenUrlKey, setSeenUrlKey] = useState(urlKey);
  const [ownChange, setOwnChange] = useState(false);
  const [resetCount, setResetCount] = useState(0);
  if (seenUrlKey !== urlKey) {
    setSeenUrlKey(urlKey);
    if (ownChange) setOwnChange(false);
    else setResetCount((n) => n + 1);
  }

  function apply(form: HTMLFormElement) {
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === "string" && value.trim() !== "" && !(key === "sort" && value === "newest")) {
        params.append(key, value.trim());
      }
    }
    const qs = params.toString();
    if (qs === window.location.search.replace(/^\?/, "")) return;
    setOwnChange(true);
    startTransition(() => router.push(qs ? `/shop?${qs}` : "/shop", { scroll: false }));
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    apply(e.currentTarget);
    setOpen(false);
  }

  function onChange(e: FormEvent<HTMLFormElement>) {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    // Text and number boxes wait for Enter or the Apply button.
    if (target.type === "checkbox" || target.type === "radio" || target.tagName === "SELECT") {
      apply(e.currentTarget);
    }
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="catalog-filters"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-accent text-sm font-medium lg:hidden"
      >
        <FilterIcon />
        {open ? "Hide filters" : "Search & filter"}
        {activeCount > 0 && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-white">{activeCount}</span>
        )}
      </button>
      <form
        id="catalog-filters"
        action="/shop"
        method="get"
        onSubmit={onSubmit}
        onChange={onChange}
        aria-busy={pending}
        className={`${open ? "mt-6 block" : "hidden"} lg:mt-0 lg:block`}
      >
        <div key={resetCount}>{children}</div>
      </form>
    </div>
  );
}
