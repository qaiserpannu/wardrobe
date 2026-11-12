import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { SearchIcon } from "@/components/ui/icons";
import { ArchMark } from "@/components/ui/Ornament";
import { getCachedCategories, getCachedSettings } from "@/server/services/cached";
import { MobileMenu } from "./MobileMenu";

export async function Header() {
  const [settings, groups] = await Promise.all([getCachedSettings(), getCachedCategories()]);
  const href = (slug: string) => `/shop?category=${slug}`;
  const mobileLinks = [
    { href: "/", label: "Home" },
    { href: "/shop", label: "Shop all" },
    ...groups.map((g) => ({
      href: href(g.slug),
      label: g.name,
      children: g.children.map((c) => ({ href: href(c.slug), label: c.name })),
    })),
    { href: "/#how-it-works", label: "How it works" },
  ];

  return (
    <>
      {settings.branding.announcement && (
        <p className="bg-accent-dark px-4 py-2 text-center text-xs tracking-[0.14em] text-gold-light uppercase">
          {settings.branding.announcement}
        </p>
      )}
      <header className="sticky top-0 z-30 border-b border-gold/40 bg-canvas/95 backdrop-blur">
      <Container className="relative flex h-16 items-center justify-between gap-4 lg:h-20">
        <MobileMenu links={mobileLinks} />

        <Link
          href="/"
          className="flex items-center gap-2 font-display text-2xl leading-none font-semibold tracking-tight text-accent lg:text-[1.7rem]"
        >
          <ArchMark className="hidden h-8 w-7 text-gold sm:block" />
          <span className="flex flex-col">
            {settings.branding.siteName}
            {settings.branding.byline && (
              <span
                className="mt-1 font-sans text-[0.62rem] leading-none font-medium tracking-[0.28em] text-muted uppercase"
                data-testid="logo-byline"
              >
                {settings.branding.byline}
              </span>
            )}
          </span>
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-7 text-sm tracking-wide">
            <li>
              <Link href="/shop" className="py-2 hover:text-accent">
                Shop all
              </Link>
            </li>
            {groups.map((group) => (
              <li key={group.slug} className="group/menu relative">
                <Link
                  href={href(group.slug)}
                  aria-haspopup={group.children.length > 0 ? "true" : undefined}
                  className="inline-flex items-center gap-1 py-2 hover:text-accent"
                >
                  {group.name}
                  {group.children.length > 0 && (
                    <svg viewBox="0 0 12 12" aria-hidden className="size-2.5 text-muted" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="m2 4 4 4 4-4" />
                    </svg>
                  )}
                </Link>
                {group.children.length > 0 && (
                  // Opens on hover and on keyboard focus; the group name itself is also a link.
                  <ul
                    data-testid={`submenu-${group.slug}`}
                    className="invisible absolute top-full left-1/2 z-40 min-w-48 -translate-x-1/2 rounded-sm border border-gold/50 bg-canvas py-2 opacity-0 shadow-lg transition-opacity group-focus-within/menu:visible group-focus-within/menu:opacity-100 group-hover/menu:visible group-hover/menu:opacity-100"
                  >
                    <li>
                      <Link href={href(group.slug)} className="block px-5 py-2 font-medium text-accent hover:bg-sand">
                        All {group.name}
                      </Link>
                    </li>
                    {group.children.map((child) => (
                      <li key={child.slug}>
                        <Link href={href(child.slug)} className="block px-5 py-2 hover:bg-sand hover:text-accent">
                          {child.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <form action="/shop" role="search" className="hidden items-center md:flex">
          <label htmlFor="header-search" className="sr-only">
            Search the shop
          </label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input
              id="header-search"
              type="search"
              name="q"
              placeholder="Search"
              maxLength={100}
              className="h-10 w-40 rounded-full border border-line bg-surface pr-3 pl-9 text-sm placeholder:text-muted xl:w-52"
            />
          </div>
        </form>
        <Link
          href="/shop"
          aria-label="Search the shop"
          className="-mr-2 flex size-11 items-center justify-center rounded-full md:hidden"
        >
          <SearchIcon />
        </Link>
      </Container>
      </header>
    </>
  );
}
