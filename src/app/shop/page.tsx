import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActiveFilters } from "@/components/catalog/ActiveFilters";
import { FilterPanel } from "@/components/catalog/FilterPanel";
import { Pagination } from "@/components/catalog/Pagination";
import { ProductGrid, ProductGridSkeleton } from "@/components/catalog/ProductGrid";
import { Container } from "@/components/ui/Container";
import { Ornament } from "@/components/ui/Ornament";
import { catalogHref, countActiveFilters, parseCatalogParams } from "@/lib/catalog-params";
import { getCachedSettings } from "@/server/services/cached";
import { findCategory, listCategoryTree } from "@/server/services/categories";
import { getCatalogFacets, listProducts } from "@/server/services/products";

export const metadata: Metadata = {
  title: "Shop all",
  description: "Browse every pre-loved Indian and Pakistani outfit currently in the shop. Search and filter by category, size, brand, price and condition.",
};

async function Catalog({ searchParams }: { searchParams: PageProps<"/shop">["searchParams"] }) {
  const filters = parseCatalogParams(await searchParams);
  const [settings, categories, facets, result] = await Promise.all([
    getCachedSettings(),
    listCategoryTree(),
    getCatalogFacets(),
    listProducts(filters),
  ]);
  const { shop } = settings;
  const categoryName = findCategory(categories, filters.category)?.name;
  const filtered = countActiveFilters(filters) > 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[16rem_1fr] lg:gap-12">
      <aside aria-label="Search and filters">
        <FilterPanel filters={filters} categories={categories} facets={facets} currency={shop.currency} />
      </aside>

      <section aria-label="Products" id="results">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-medium">{categoryName ?? "All items"}</h2>
          <p className="text-sm text-muted" role="status" data-testid="result-count">
            {result.total} {result.total === 1 ? "item" : "items"}
          </p>
        </div>

        <ActiveFilters filters={filters} categories={categories} shop={shop} />

        {result.items.length > 0 ? (
          <>
            <ProductGrid products={result.items} shop={shop} columns={3} priorityCount={3} />
            <Pagination filters={filters} page={result.page} pageCount={result.pageCount} />
          </>
        ) : (
          <div className="rounded-sm border border-line bg-surface px-6 py-16 text-center" data-testid="no-results">
            <p className="font-display text-2xl">{filtered ? "No items match your search" : "Nothing in the shop yet"}</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              {filtered
                ? "Try removing a filter or searching for something else."
                : "New pieces are on their way. Please check back soon."}
            </p>
            {filtered && (
              <Link
                href={catalogHref({})}
                className="mt-6 inline-flex min-h-11 items-center rounded-full border border-accent px-6 text-sm font-medium hover:bg-accent hover:text-white"
              >
                Clear all filters
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function CatalogFallback() {
  return (
    <div className="grid gap-8 lg:grid-cols-[16rem_1fr] lg:gap-12">
      <div className="hidden h-96 animate-pulse rounded-sm bg-sand lg:block" />
      <ProductGridSkeleton count={6} columns={3} />
    </div>
  );
}

export default function ShopPage({ searchParams }: PageProps<"/shop">) {
  return (
    <Container className="py-10 sm:py-14">
      <header className="mb-8 sm:mb-12">
        <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">The collection</p>
        <h1 className="mt-2 font-display text-4xl font-medium sm:text-5xl">Shop</h1>
        <Ornament className="mt-4" />
      </header>
      <Suspense fallback={<CatalogFallback />}>
        <Catalog searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
