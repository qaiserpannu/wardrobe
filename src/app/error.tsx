"use client";

import { Container } from "@/components/ui/Container";

export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <Container className="py-24 text-center">
      <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">Something went wrong</p>
      <h1 className="mt-3 font-display text-4xl font-medium sm:text-5xl">We hit a snag</h1>
      <p className="mx-auto mt-4 max-w-md text-muted">Please try again. If the problem continues, come back a little later.</p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-8 inline-flex min-h-12 items-center rounded-full bg-ink px-7 text-sm font-medium text-white hover:bg-accent-dark"
      >
        Try again
      </button>
    </Container>
  );
}
