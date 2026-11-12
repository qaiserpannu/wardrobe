import Image from "next/image";
import Link from "next/link";
import { CONDITION_LABELS } from "@/lib/conditions";
import { formatPrice } from "@/lib/money";
import type { SiteSettings } from "@/lib/settings";
import type { PublicProduct } from "@/server/services/types";
import { SoldBadge } from "./StatusBadge";

type Props = {
  product: PublicProduct;
  shop: SiteSettings["shop"];
  /** Load the image eagerly for cards at the top of the page. */
  priority?: boolean;
};

export function ProductCard({ product, shop, priority }: Props) {
  const sold = product.status === "sold";
  const image = product.images[0];
  const details = [product.brand, product.size ? `Size ${product.size}` : null, CONDITION_LABELS[product.condition]]
    .filter(Boolean)
    .join(" · ");

  return (
    <article data-testid="product-card" data-status={product.status} className="group relative">
      <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-sand">
        {image ? (
          <Image
            src={image.url}
            alt={image.alt}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            loading={priority ? "eager" : "lazy"}
            className={`object-cover transition-transform duration-500 group-hover:scale-[1.03] ${sold ? "opacity-60 grayscale-[35%]" : ""}`}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted">No photo yet</div>
        )}
        {sold && <SoldBadge className="absolute top-3 left-3" />}
      </div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm leading-snug font-medium sm:text-[0.95rem]">
            <Link href={`/shop/${product.slug}`} className="after:absolute after:inset-0">
              {product.name}
            </Link>
          </h3>
          <p className="mt-1 text-xs text-muted sm:text-[0.8rem]">{details}</p>
        </div>
        <p className={`shrink-0 text-sm font-medium sm:text-[0.95rem] ${sold ? "text-muted line-through" : ""}`}>
          {formatPrice(product.priceCents, shop.currency, shop.locale)}
        </p>
      </div>
    </article>
  );
}
