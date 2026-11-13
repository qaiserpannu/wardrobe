import type { ReactNode } from "react";

export function PageHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="mb-8">
      <h1 className="font-display text-3xl font-medium sm:text-4xl">{title}</h1>
      {children && <p className="mt-2 max-w-2xl text-muted">{children}</p>}
    </header>
  );
}
