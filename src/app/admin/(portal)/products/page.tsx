import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { primaryButtonClass, inputClass } from "@/components/admin/fields";
import { PageHeading } from "@/components/admin/PageHeading";
import { StatusPill } from "@/components/admin/StatusPill";
import { formatDateTime, timeUntil } from "@/lib/dates";
import { formatPrice } from "@/lib/money";
import { PRODUCT_STATUSES, type ProductStatus, STATUS_LABELS } from "@/lib/product-form";
import { requireAdmin } from "@/server/auth/session";
import { countProductsByStatus } from "@/server/services/admin-dashboard";
import { listAdminProducts } from "@/server/services/admin-products";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Items" };

type Search = PageProps<"/admin/products">["searchParams"];

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const TAB_ORDER: ProductStatus[] = ["available", "pending", "sold", "draft", "archived"];

function href(params: { status?: string; q?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.q) query.set("q", params.q);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  const text = query.toString();
  return text ? `/admin/products?${text}` : "/admin/products";
}

async function ProductList({ searchParams }: { searchParams: Search }) {
  await requireAdmin();
  const raw = await searchParams;
  const statusRaw = first(raw.status);
  const status = PRODUCT_STATUSES.find((s) => s === statusRaw);
  const q = first(raw.q)?.trim().slice(0, 100) || undefined;
  const page = Number(first(raw.page)) || 1;

  const [result, counts, settings] = await Promise.all([listAdminProducts({ status, search: q, page }), countProductsByStatus(), getSettings()]);
  const { currency, locale, timeZone } = settings.shop;
  const all = Object.values(counts).reduce((a, b) => a + b, 0);
  const tabClass = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap ${active ? "bg-accent text-white" : "border border-line bg-white hover:border-accent"}`;

  return (
    <>
      <nav aria-label="Filter by status" className="flex gap-2 overflow-x-auto pb-1" data-testid="status-tabs">
        <Link href={href({ q })} className={tabClass(!status)} aria-current={!status ? "page" : undefined}>
          All ({all})
        </Link>
        {TAB_ORDER.map((s) => (
          <Link key={s} href={href({ status: s, q })} className={tabClass(status === s)} aria-current={status === s ? "page" : undefined}>
            {STATUS_LABELS[s]} ({counts[s]})
          </Link>
        ))}
      </nav>

      <form action="/admin/products" className="mt-4 flex max-w-xl gap-2" role="search">
        {status && <input type="hidden" name="status" value={status} />}
        <label htmlFor="q" className="sr-only">
          Search items
        </label>
        <input id="q" name="q" type="search" defaultValue={q} placeholder="Search by name, product ID or brand" className={inputClass} />
        <button type="submit" className="rounded-full border border-accent px-5 text-sm font-medium text-accent hover:bg-accent hover:text-white">
          Search
        </button>
      </form>

      <p className="mt-5 text-sm text-muted" role="status" data-testid="admin-result-count">
        {result.total} {result.total === 1 ? "item" : "items"}
      </p>

      {result.items.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-line bg-surface p-8 text-center text-muted">Nothing matches.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface" data-testid="admin-product-list">
          {result.items.map((item) => (
            <li key={item.id}>
              <Link href={`/admin/products/${item.id}`} className="flex items-center gap-4 p-3 hover:bg-sand/60 sm:p-4" data-testid="admin-product">
                <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-md bg-sand">
                  {item.cover ? (
                    <Image src={item.cover.url} alt="" fill sizes="64px" className="object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-center text-[0.65rem] text-muted">No photo</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {item.code} · {item.categoryName}
                    {item.size ? ` · ${item.size}` : ""} · {formatPrice(item.priceCents, currency, locale)}
                    {item.isFeatured ? " · Featured" : ""}
                  </p>
                  {item.status === "pending" && item.heldFor && (
                    <p className="mt-0.5 text-sm">
                      Held for {item.heldFor}
                      {item.holdExpiresAt ? `, ends ${timeUntil(item.holdExpiresAt)}` : ""}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-muted">Changed {formatDateTime(item.updatedAt, locale, timeZone)}</p>
                </div>
                <StatusPill status={item.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {result.pageCount > 1 && (
        <nav aria-label="Pages" className="mt-5 flex items-center justify-between text-sm">
          {result.page > 1 ? (
            <Link href={href({ status, q, page: result.page - 1 })} className="text-accent underline-offset-4 hover:underline">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Page {result.page} of {result.pageCount}
          </span>
          {result.page < result.pageCount ? (
            <Link href={href({ status, q, page: result.page + 1 })} className="text-accent underline-offset-4 hover:underline">
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}

export default function ProductsPage({ searchParams }: { searchParams: Search }) {
  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-x-4">
        <PageHeading title="Items">Everything in the shop, including drafts and archived items.</PageHeading>
        <Link href="/admin/products/new" className={primaryButtonClass} data-testid="add-item">
          Add an item
        </Link>
      </div>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <ProductList searchParams={searchParams} />
      </Suspense>
    </>
  );
}
