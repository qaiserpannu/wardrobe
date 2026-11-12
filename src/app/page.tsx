import Image from "next/image";
import { io } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { ProductGrid, ProductGridSkeleton } from "@/components/catalog/ProductGrid";
import { SectionHeading } from "@/components/home/SectionHeading";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { ArrowRightIcon, WhatsAppIcon } from "@/components/ui/icons";
import { Ornament } from "@/components/ui/Ornament";
import { buildWhatsAppLink } from "@/integrations/whatsapp";
import type { SiteSettings } from "@/lib/settings";
import { getCachedCategories, getCachedSettings } from "@/server/services/cached";
import { getFeaturedProducts, getRecentProducts } from "@/server/services/products";
import { mediaUrl } from "@/server/services/settings";

/**
 * Product sections are never part of the prerendered page shell. "await io()"
 * says so explicitly, before any database work starts. Without it, opening a
 * database connection (which generates a random value for the password
 * handshake) can happen while Next.js is prerendering and is reported as an
 * error.
 */
async function FeaturedSection({ shop }: { shop: SiteSettings["shop"] }) {
  await io();
  const products = await getFeaturedProducts(4);
  if (products.length === 0) return null;
  return (
    <section aria-label="Featured outfits" className="mt-20 sm:mt-28" data-testid="featured">
      <Container>
        <SectionHeading eyebrow="Hand-picked" title="Featured outfits" href="/shop" linkLabel="Shop all" />
        <ProductGrid products={products} shop={shop} />
      </Container>
    </section>
  );
}

async function RecentSection({ shop }: { shop: SiteSettings["shop"] }) {
  await io();
  const products = await getRecentProducts(8);
  if (products.length === 0) {
    return (
      <Container className="mt-20 text-center text-muted">
        <p>New pieces are on their way. Please check back soon.</p>
      </Container>
    );
  }
  return (
    <section aria-label="Recently added" className="mt-20 sm:mt-28" data-testid="recent">
      <Container>
        <SectionHeading eyebrow="Just in" title="Recently added" href="/shop" linkLabel="View all new arrivals" />
        <ProductGrid products={products} shop={shop} />
        <div className="mt-10 text-center sm:hidden">
          <ButtonLink href="/shop" variant="outline">
            View all new arrivals
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}

function SectionFallback({ title, count }: { title: string; count: number }) {
  return (
    <div className="mt-20 sm:mt-28">
      <Container>
        <SectionHeading title={title} />
        <ProductGridSkeleton count={count} />
      </Container>
    </div>
  );
}

export default async function Home() {
  const [settings, categories] = await Promise.all([getCachedSettings(), getCachedCategories()]);
  const { homepage, shop, whatsapp } = settings;
  const heroImage = mediaUrl(homepage.heroImageKey);
  const whatsappLink = buildWhatsAppLink(whatsapp.number, whatsapp.generalMessage);

  return (
    <>
      <section className="pattern-jali border-b border-gold/30 bg-sand">
        <Container className="grid items-center gap-10 py-10 sm:py-14 lg:grid-cols-[1.15fr_1fr] lg:gap-14 lg:py-16">
          <div className="max-w-xl">
            <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">{homepage.heroEyebrow}</p>
            <h1 className="mt-4 font-display text-[2.6rem] leading-[1.05] font-medium text-balance sm:text-6xl lg:text-[4.2rem]">
              {homepage.heroTitle}
            </h1>
            <Ornament className="mt-5" />
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted sm:text-lg">{homepage.heroText}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/shop">
                Shop the collection <ArrowRightIcon />
              </ButtonLink>
              <ButtonLink href="/#how-it-works" variant="outline" className="bg-canvas">
                How it works
              </ButtonLink>
            </div>
          </div>
          {heroImage && (
            <div className="mx-auto w-full max-w-xs rounded-t-full border border-gold p-2 sm:max-w-sm lg:max-w-md">
              <div className="relative aspect-[4/5] overflow-hidden rounded-t-full">
                <Image
                  src={heroImage}
                  alt=""
                  fill
                  loading="eager"
                  fetchPriority="high"
                  sizes="(min-width: 1024px) 28rem, (min-width: 640px) 24rem, 20rem"
                  className="object-cover"
                />
              </div>
            </div>
          )}
        </Container>
      </section>

      <Suspense fallback={<SectionFallback title="Featured outfits" count={4} />}>
        <FeaturedSection shop={shop} />
      </Suspense>

      <section aria-labelledby="categories-heading" className="mt-20 sm:mt-28">
        <Container>
          <SectionHeading eyebrow="Find your style" title="Browse by category" id="categories-heading" />
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4 sm:gap-x-6" data-testid="category-list">
            {categories.map((group) => (
              <li key={group.slug} data-testid="category-group">
                <Link
                  href={`/shop?category=${group.slug}`}
                  className="group block rounded-t-full border border-gold/60 p-1.5 transition-colors hover:border-accent"
                >
                  <span className="pattern-jali flex aspect-[4/5] flex-col items-center justify-end gap-3 rounded-t-full bg-sand px-3 pb-7 text-center transition-colors group-hover:bg-accent group-hover:text-white sm:pb-9 lg:aspect-[10/11]">
                    <Ornament className="group-hover:text-gold-light" />
                    <span className="font-display text-2xl leading-tight font-medium sm:text-3xl">{group.name}</span>
                    <span className="inline-flex items-center gap-1.5 text-xs tracking-[0.14em] uppercase opacity-70">
                      Shop all <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-1" />
                    </span>
                  </span>
                </Link>
                {group.children.length > 0 && (
                  <ul className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 px-1 text-sm">
                    {group.children.map((c) => (
                      <li key={c.slug}>
                        <Link href={`/shop?category=${c.slug}`} className="inline-block py-1 text-muted underline-offset-4 hover:text-accent hover:underline">
                          {c.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <Suspense fallback={<SectionFallback title="Recently added" count={8} />}>
        <RecentSection shop={shop} />
      </Suspense>

      <section id="how-it-works" aria-labelledby="how-heading" className="mt-20 scroll-mt-24 sm:mt-28">
        <Container>
          <div className="pattern-jali rounded-sm border border-gold/40 bg-sand px-6 py-12 sm:px-12 sm:py-16">
            <h2 id="how-heading" className="text-center font-display text-3xl font-medium sm:text-4xl">
              {homepage.aboutTitle}
            </h2>
            <Ornament className="mt-4 justify-center" />
            <ol className="mt-10 grid gap-8 sm:grid-cols-3">
              {homepage.steps.map((step, i) => (
                <li key={step.title} className="text-center">
                  <p className="font-display text-4xl text-accent">{i + 1}</p>
                  <h3 className="mt-2 text-base font-semibold">{step.title}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">{step.text}</p>
                </li>
              ))}
            </ol>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/shop">Start browsing</ButtonLink>
              {whatsappLink && (
                <ButtonLink href={whatsappLink} variant="whatsapp" external>
                  <WhatsAppIcon /> Ask on WhatsApp
                </ButtonLink>
              )}
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
