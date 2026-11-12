import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { SearchIcon } from "@/components/ui/icons";
import { getCachedCategories, getCachedSettings } from "@/server/services/cached";
import { MobileMenu } from "./MobileMenu";

/** How many categories fit in the desktop navigation bar; the rest are reachable from the shop page. */
const DESKTOP_CATEGORY_LIMIT = 5;

export async function Header() {
  const [settings, categories] = await Promise.all([getCachedSettings(), getCachedCategories()]);
  const categoryLinks = categories.map((c) => ({ href: `/shop?category=${c.slug}`, label: c.name }));
  const mobileLinks = [
    { href: "/", label: "Home" },
    { href: "/shop", label: "Shop all" },
    ...categoryLinks,
    { href: "/#how-it-works", label: "How it works" },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 backdrop-blur">
      <Container className="relative flex h-16 items-center justify-between gap-4 lg:h-20">
        <MobileMenu links={mobileLinks} />

        <Link href="/" className="font-display text-2xl leading-none font-semibold tracking-tight lg:text-[1.7rem]">
          {settings.branding.siteName}
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-7 text-sm tracking-wide">
            <li>
              <Link href="/shop" className="py-2 hover:text-accent">
                Shop all
              </Link>
            </li>
            {categoryLinks.slice(0, DESKTOP_CATEGORY_LIMIT).map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="py-2 hover:text-accent">
                  {link.label}
                </Link>
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
  );
}
