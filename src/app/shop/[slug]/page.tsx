import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductGallery } from "@/components/catalog/ProductGallery";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { AvailableBadge, SoldBadge } from "@/components/catalog/StatusBadge";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { WhatsAppIcon } from "@/components/ui/icons";
import { buildProductInquiryLink } from "@/integrations/whatsapp";
import { CONDITION_DESCRIPTIONS, CONDITION_LABELS } from "@/lib/conditions";
import { formatPrice } from "@/lib/money";
import { siteUrl } from "@/lib/site-url";
import { getCachedSettings } from "@/server/services/cached";
import { getProductBySlug, getRelatedProducts } from "@/server/services/products";

type Props = PageProps<"/shop/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Item not found", robots: { index: false } };
  const { shop } = await getCachedSettings();
  const price = formatPrice(product.priceCents, shop.currency, shop.locale);
  const summary = [product.brand, product.size ? `Size ${product.size}` : null, CONDITION_LABELS[product.condition]]
    .filter(Boolean)
    .join(" · ");
  const description = `${product.status === "sold" ? "Sold" : price} · ${summary}. ${product.description}`.slice(0, 200);
  return {
    title: product.name,
    description,
    alternates: { canonical: `/shop/${product.slug}` },
    openGraph: {
      title: product.name,
      description,
      images: product.images.slice(0, 1).map((img) => ({ url: img.url, width: img.width, height: img.height })),
    },
  };
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line py-3 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className={`text-right ${value ? "font-medium" : "text-muted"}`}>{value ?? "Not specified"}</dd>
    </div>
  );
}

async function ProductDetails({ params }: { params: Props["params"] }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [settings, related] = await Promise.all([getCachedSettings(), getRelatedProducts(product, 4)]);
  const { shop, whatsapp } = settings;
  const sold = product.status === "sold";
  const price = formatPrice(product.priceCents, shop.currency, shop.locale);
  const productUrl = `${siteUrl()}/shop/${product.slug}`;
  const inquiryLink = sold ? null : buildProductInquiryLink(whatsapp, product, productUrl);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.code,
    description: product.description,
    image: product.images.map((img) => `${siteUrl()}${img.url}`),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    ...(product.color ? { color: product.color } : {}),
    ...(product.size ? { size: product.size } : {}),
    itemCondition: product.condition === "new_with_tags" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
    offers: {
      "@type": "Offer",
      url: productUrl,
      price: (product.priceCents / 100).toFixed(2),
      priceCurrency: shop.currency,
      availability: sold ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-ink">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href="/shop" className="hover:text-ink">
              Shop
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href={`/shop?category=${product.category.slug}`} className="hover:text-ink">
              {product.category.name}
            </Link>
          </li>
        </ol>
      </nav>

      <article className="grid gap-8 lg:grid-cols-2 lg:gap-14" data-testid="product-detail" data-status={product.status}>
        <ProductGallery images={product.images} sold={sold} />

        <div className="lg:py-2">
          {product.brand && <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">{product.brand}</p>}
          <h1 className="mt-2 font-display text-4xl leading-tight font-medium sm:text-5xl">{product.name}</h1>

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <p className={`text-2xl font-medium ${sold ? "text-muted line-through" : ""}`} data-testid="product-price">
              {price}
            </p>
            {sold ? <SoldBadge /> : <AvailableBadge />}
          </div>

          {product.description && <p className="mt-6 max-w-prose leading-relaxed text-muted">{product.description}</p>}

          <dl className="mt-8 border-t border-line">
            <Detail label="Brand" value={product.brand} />
            <Detail label="Size" value={product.size} />
            <Detail label="Colour" value={product.color} />
            <Detail label="Condition" value={CONDITION_LABELS[product.condition]} />
            <Detail label="Category" value={product.category.name} />
            <Detail label="Product ID" value={product.code} />
          </dl>
          <p className="mt-3 text-xs text-muted">
            {CONDITION_LABELS[product.condition]}: {CONDITION_DESCRIPTIONS[product.condition]}
          </p>

          <div className="mt-8">
            {sold ? (
              <div className="rounded-sm border border-line bg-sand p-5" data-testid="sold-notice">
                <p className="font-medium">This item has been sold.</p>
                <p className="mt-1 text-sm text-muted">Every piece is one of a kind, but similar items may be available.</p>
                <ButtonLink href={`/shop?category=${product.category.slug}&hideSold=1`} variant="outline" className="mt-4">
                  Browse available {product.category.name.toLowerCase()}
                </ButtonLink>
              </div>
            ) : inquiryLink ? (
              <>
                <ButtonLink href={inquiryLink} variant="whatsapp" external className="w-full sm:w-auto">
                  <WhatsAppIcon /> Ask about this item on WhatsApp
                </ButtonLink>
                <p className="mt-3 text-xs text-muted">
                  Opens WhatsApp with a message that mentions this item ({product.code}).
                </p>
              </>
            ) : (
              <p className="rounded-sm border border-line bg-sand p-5 text-sm text-muted" data-testid="whatsapp-unavailable">
                To ask about this item, please quote product ID <strong className="text-ink">{product.code}</strong>.
                WhatsApp contact is being set up.
              </p>
            )}
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="mt-20 sm:mt-28">
          <h2 id="related-heading" className="mb-8 font-display text-3xl font-medium">
            More {product.category.name.toLowerCase()}
          </h2>
          <ProductGrid products={related} shop={shop} />
        </section>
      )}
    </>
  );
}

function ProductFallback() {
  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-14" aria-hidden>
      <div className="aspect-[4/5] animate-pulse rounded-sm bg-sand" />
      <div className="space-y-4 py-2">
        <div className="h-10 w-3/4 animate-pulse rounded bg-sand" />
        <div className="h-7 w-24 animate-pulse rounded bg-sand" />
        <div className="h-24 animate-pulse rounded bg-sand" />
      </div>
    </div>
  );
}

export default function ProductPage({ params }: Props) {
  return (
    <Container className="py-8 sm:py-12">
      <Suspense fallback={<ProductFallback />}>
        <ProductDetails params={params} />
      </Suspense>
    </Container>
  );
}
