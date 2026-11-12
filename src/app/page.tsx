import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ProductGrid, ProductGridSkeleton } from "@/components/catalog/ProductGrid";
import { SectionHeading } from "@/components/home/SectionHeading";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { ArrowRightIcon, WhatsAppIcon } from "@/components/ui/icons";
import { buildWhatsAppLink } from "@/integrations/whatsapp";
import type { SiteSettings } from "@/lib/settings";
import { getCachedCategories, getCachedSettings } from "@/server/services/cached";
import { getFeaturedProducts, getRecentProducts } from "@/server/services/products";
import { mediaUrl } from "@/server/services/settings";

async function FeaturedSection({ shop }: { shop: SiteSettings["shop"] }) {
  const products = await getFeaturedProducts(4);
  if (products.length === 0) return null;
  return (
    <section aria-label="Featured pieces" className="mt-20 sm:mt-28" data-testid="featured">
      <Container>
        <SectionHeading eyebrow="Hand-picked" title="Featured pieces" href="/shop" linkLabel="Shop all" />
        <ProductGrid products={products} shop={shop} />
      </Container>
    </section>
  );
}

async function RecentSection({ shop }: { shop: SiteSettings["shop"] }) {
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
      <section className="bg-sand">
        <Container className="grid items-center gap-8 py-10 sm:py-14 lg:grid-cols-2 lg:gap-14 lg:py-20">
          <div className="max-w-xl">
            <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">{homepage.heroEyebrow}</p>
            <h1 className="mt-4 font-display text-[2.6rem] leading-[1.05] font-medium text-balance sm:text-6xl lg:text-[4.2rem]">
              {homepage.heroTitle}
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted sm:text-lg">{homepage.heroText}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/shop">
                Shop the collection <ArrowRightIcon />
              </ButtonLink>
              <ButtonLink href="/#how-it-works" variant="outline">
                How it works
              </ButtonLink>
            </div>
          </div>
          {heroImage && (
            <div className="relative aspect-[4/3] overflow-hidden rounded-sm lg:aspect-[5/4]">
              <Image
                src={heroImage}
                alt=""
                fill
                loading="eager"
                fetchPriority="high"
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          )}
        </Container>
      </section>

      <Suspense fallback={<SectionFallback title="Featured pieces" count={4} />}>
        <FeaturedSection shop={shop} />
      </Suspense>

      <section aria-labelledby="categories-heading" className="mt-20 sm:mt-28">
        <Container>
          <div className="mb-8 sm:mb-10">
            <p className="mb-2 text-xs font-semibold tracking-[0.2em] text-accent uppercase">Find your fit</p>
            <h2 id="categories-heading" className="font-display text-3xl leading-tight font-medium sm:text-4xl">
              Browse by category
            </h2>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4" data-testid="category-list">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/shop?category=${c.slug}`}
                  className="group flex min-h-24 items-center justify-between rounded-sm border border-line bg-surface px-5 transition-colors hover:border-ink sm:min-h-28"
                >
                  <span className="font-display text-xl font-medium sm:text-2xl">{c.name}</span>
                  <ArrowRightIcon className="size-4 text-muted transition-transform group-hover:translate-x-1 group-hover:text-ink" />
                </Link>
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
          <div className="rounded-sm bg-sand px-6 py-12 sm:px-12 sm:py-16">
            <h2 id="how-heading" className="text-center font-display text-3xl font-medium sm:text-4xl">
              {homepage.aboutTitle}
            </h2>
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
