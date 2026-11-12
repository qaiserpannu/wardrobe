import { ButtonLink } from "./ButtonLink";

/** The "we couldn't find that" message, shared by the 404 page and missing product pages. */
export function NotFoundMessage() {
  return (
    <div className="py-24 text-center" data-testid="not-found">
      <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">Not found</p>
      <h1 className="mt-3 font-display text-4xl font-medium sm:text-5xl">We couldn&apos;t find that page</h1>
      <p className="mx-auto mt-4 max-w-md text-muted">The item may have been removed, or the link may be incorrect.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/shop">Browse the shop</ButtonLink>
        <ButtonLink href="/" variant="outline">
          Go to homepage
        </ButtonLink>
      </div>
    </div>
  );
}
