import type { SiteSettings } from "@/lib/settings";
import type { PublicProduct } from "@/server/services/types";
import { ProductCard } from "./ProductCard";

const COLUMNS = {
  3: "grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
} as const;

type Props = {
  products: PublicProduct[];
  shop: SiteSettings["shop"];
  columns?: keyof typeof COLUMNS;
  /** Number of leading cards whose images load eagerly. */
  priorityCount?: number;
};

export function ProductGrid({ products, shop, columns = 4, priorityCount = 0 }: Props) {
  return (
    <ul className={`grid gap-x-4 gap-y-9 sm:gap-x-6 ${COLUMNS[columns]}`}>
      {products.map((product, i) => (
        <li key={product.code}>
          <ProductCard product={product} shop={shop} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}

export function ProductGridSkeleton({ count = 4, columns = 4 }: { count?: number; columns?: keyof typeof COLUMNS }) {
  return (
    <ul className={`grid gap-x-4 gap-y-9 sm:gap-x-6 ${COLUMNS[columns]}`} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <div className="aspect-[4/5] animate-pulse rounded-sm bg-sand" />
          <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-sand" />
          <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-sand" />
        </li>
      ))}
    </ul>
  );
}
