import Link from "next/link";
import { catalogHref, type CatalogFilters } from "@/lib/catalog-params";
import { CONDITION_LABELS } from "@/lib/conditions";
import { OCCASION_LABELS, STITCHING_LABELS, piecesLabel } from "@/lib/product-options";
import { formatPrice } from "@/lib/money";
import type { SiteSettings } from "@/lib/settings";
import type { PublicCategoryGroup } from "@/server/services/types";

type Props = {
  filters: CatalogFilters;
  categories: PublicCategoryGroup[];
  shop: SiteSettings["shop"];
};

/** One removable "chip" per active filter, plus a clear-all link. */
export function ActiveFilters({ filters, categories, shop }: Props) {
  const base = { ...filters, page: 1 };
  const price = (cents: number) => formatPrice(cents, shop.currency, shop.locale);
  const chips: { label: string; href: string }[] = [];

  if (filters.q) chips.push({ label: `"${filters.q}"`, href: catalogHref({ ...base, q: "" }) });
  if (filters.category) {
    const all = categories.flatMap((g) => [g, ...g.children]);
    const name = all.find((c) => c.slug === filters.category)?.name ?? filters.category;
    chips.push({ label: name, href: catalogHref({ ...base, category: null }) });
  }
  for (const s of filters.sizes) {
    chips.push({ label: `Size ${s}`, href: catalogHref({ ...base, sizes: filters.sizes.filter((x) => x !== s) }) });
  }
  for (const b of filters.brands) {
    chips.push({ label: b, href: catalogHref({ ...base, brands: filters.brands.filter((x) => x !== b) }) });
  }
  for (const c of filters.conditions) {
    chips.push({
      label: CONDITION_LABELS[c],
      href: catalogHref({ ...base, conditions: filters.conditions.filter((x) => x !== c) }),
    });
  }
  for (const f of filters.fabrics) {
    chips.push({ label: f, href: catalogHref({ ...base, fabrics: filters.fabrics.filter((x) => x !== f) }) });
  }
  for (const o of filters.occasions) {
    chips.push({
      label: OCCASION_LABELS[o],
      href: catalogHref({ ...base, occasions: filters.occasions.filter((x) => x !== o) }),
    });
  }
  for (const v of filters.stitching) {
    chips.push({
      label: STITCHING_LABELS[v],
      href: catalogHref({ ...base, stitching: filters.stitching.filter((x) => x !== v) }),
    });
  }
  for (const n of filters.pieces) {
    chips.push({ label: piecesLabel(n), href: catalogHref({ ...base, pieces: filters.pieces.filter((x) => x !== n) }) });
  }
  if (filters.minPriceCents != null) {
    chips.push({ label: `From ${price(filters.minPriceCents)}`, href: catalogHref({ ...base, minPriceCents: null }) });
  }
  if (filters.maxPriceCents != null) {
    chips.push({ label: `Up to ${price(filters.maxPriceCents)}`, href: catalogHref({ ...base, maxPriceCents: null }) });
  }
  if (filters.hideSold) chips.push({ label: "Available only", href: catalogHref({ ...base, hideSold: false }) });

  if (chips.length === 0) return null;

  return (
    <ul className="mb-6 flex flex-wrap items-center gap-2" aria-label="Active filters">
      {chips.map((chip) => (
        <li key={chip.label}>
          <Link
            href={chip.href}
            scroll={false}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm hover:border-accent"
          >
            {chip.label}
            <span aria-hidden className="text-muted">
              ×
            </span>
            <span className="sr-only">(remove filter)</span>
          </Link>
        </li>
      ))}
      <li>
        <Link href={catalogHref({ sort: filters.sort })} scroll={false} className="px-2 text-sm underline underline-offset-4">
          Clear all
        </Link>
      </li>
    </ul>
  );
}
