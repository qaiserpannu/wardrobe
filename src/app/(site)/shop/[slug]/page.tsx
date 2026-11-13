import type { Metadata } from "next";
import { io } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { ChatProductContext } from "@/components/chat/ChatProductContext";
import { ProductArticle } from "@/components/catalog/ProductArticle";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { Container } from "@/components/ui/Container";
import { NotFoundMessage } from "@/components/ui/NotFoundMessage";
import { buildProductInquiryLink } from "@/integrations/whatsapp";
import { CONDITION_LABELS } from "@/lib/conditions";
import { formatPrice } from "@/lib/money";
import { siteUrl } from "@/lib/site-url";
import { getCachedSettings } from "@/server/services/cached";
import { getProductBySlug, getRelatedProducts } from "@/server/services/products";

type Props = PageProps<"/shop/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  // Keep database work out of every prerender and prefetch (see D14).
  await io();
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Item not found", robots: { index: false } };
  const { shop } = await getCachedSettings();
  const price = formatPrice(product.priceCents, shop.currency, shop.locale);
  const summary = [product.brand, product.size ? `Size ${product.size}` : null, CONDITION_LABELS[product.condition]]
    .filter(Boolean)
    .join(" · ");
  const description = `${product.status === "sold" ? "Sold" : product.status === "pending" ? `On hold · ${price}` : price} · ${summary}. ${product.description}`.slice(0, 200);
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

async function ProductDetails({ params }: { params: Props["params"] }) {
  const { slug } = await params;
  // Keep database work out of every prerender and prefetch (see D14).
  await io();
  const product = await getProductBySlug(slug);
  // Shown in place rather than via notFound(): by this point the page frame has
  // already been sent, and throwing here makes the browser log an error when the
  // visitor then clicks away. Search engines are told not to index it (see
  // generateMetadata).
  if (!product) return <NotFoundMessage />;

  const [settings, related] = await Promise.all([getCachedSettings(), getRelatedProducts(product, 4)]);
  const { shop, whatsapp } = settings;
  const sold = product.status === "sold";
  const onHold = product.status === "pending";
  const price = formatPrice(product.priceCents, shop.currency, shop.locale);
  const productUrl = `${siteUrl()}/shop/${product.slug}`;
  // Only an available item gets a way to ask to buy it.
  const inquiryLink = sold || onHold ? null : buildProductInquiryLink(whatsapp, product, productUrl);

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
    ...(product.fabric ? { material: product.fabric } : {}),
    itemCondition: product.condition === "new_with_tags" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
    offers: {
      "@type": "Offer",
      url: productUrl,
      price: (product.priceCents / 100).toFixed(2),
      priceCurrency: shop.currency,
      availability: sold
        ? "https://schema.org/SoldOut"
        : onHold
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      {/* Tells the floating chat button which item the visitor is looking at. Only items that can be bought. */}
      {!sold && !onHold && <ChatProductContext name={product.name} code={product.code} url={productUrl} />}
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
          {product.group && (
            <>
              <li aria-hidden>/</li>
              <li>
                <Link href={`/shop?category=${product.group.slug}`} className="hover:text-ink">
                  {product.group.name}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden>/</li>
          <li>
            <Link href={`/shop?category=${product.category.slug}`} className="hover:text-ink">
              {product.category.name}
            </Link>
          </li>
        </ol>
      </nav>

      <ProductArticle product={product} price={price} inquiryLink={inquiryLink} />

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
