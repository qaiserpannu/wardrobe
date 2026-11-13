import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeading } from "@/components/admin/PageHeading";
import { PhotoManager } from "@/components/admin/PhotoManager";
import { ProductForm } from "@/components/admin/ProductForm";
import { StatusPanel } from "@/components/admin/StatusPanel";
import { StatusPill } from "@/components/admin/StatusPill";
import { formatDateTime, timeUntil } from "@/lib/dates";
import { STATUS_LABELS } from "@/lib/product-form";
import { requireAdmin } from "@/server/auth/session";
import { getAdminProduct, listCategoryOptions, listFieldSuggestions } from "@/server/services/admin-products";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Edit item" };

type Props = PageProps<"/admin/products/[id]">;

const cardClass = "rounded-2xl border border-line bg-surface p-5 sm:p-6";
const linkClass = "text-accent underline-offset-4 hover:underline";

async function EditProduct({ params, searchParams }: Props) {
  await requireAdmin();
  const { id } = await params;
  const created = (await searchParams).created === "1";
  const [product, categories, suggestions, settings] = await Promise.all([
    getAdminProduct(id),
    listCategoryOptions(),
    listFieldSuggestions(),
    getSettings(),
  ]);
  if (!product) {
    return (
      <div className={cardClass} data-testid="admin-not-found">
        <p className="font-medium">This item could not be found.</p>
        <p className="mt-2">
          <Link href="/admin/products" className={linkClass}>
            Back to all items
          </Link>
        </p>
      </div>
    );
  }
  const { locale, timeZone } = settings.shop;
  const when = (date: Date) => formatDateTime(date, locale, timeZone);
  const onWebsite = product.status === "available" || product.status === "pending" || product.status === "sold";

  return (
    <>
      <PageHeading title={product.name}>
        <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
          <span data-testid="product-code">{product.code}</span>
          <StatusPill status={product.status} />
          <Link href={`/admin/products/${product.id}/preview`} className={linkClass} data-testid="preview-link">
            Preview
          </Link>
          {onWebsite && (
            <a href={`/shop/${product.slug}`} target="_blank" rel="noopener noreferrer" className={linkClass} data-testid="view-on-site">
              View on the website
            </a>
          )}
        </span>
      </PageHeading>

      {created && (
        <p className="mb-6 rounded-lg border border-gold/60 bg-sand p-4 text-sm" role="status" data-testid="created-notice">
          Saved as a draft. Add photos below, then publish it from the Status box.
        </p>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <section className={cardClass} aria-labelledby="photos-heading">
            <h2 id="photos-heading" className="mb-4 font-display text-2xl font-medium">
              Photos
            </h2>
            <PhotoManager productId={product.id} productName={product.name} photos={product.images} />
          </section>

          <section className={cardClass} aria-labelledby="details-heading">
            <h2 id="details-heading" className="mb-5 font-display text-2xl font-medium">
              Details
            </h2>
            <ProductForm
              categories={categories}
              suggestions={suggestions}
              values={{
                id: product.id,
                name: product.name,
                description: product.description,
                categoryId: product.categoryId,
                brand: product.brand ?? "",
                size: product.size ?? "",
                color: product.color ?? "",
                fabric: product.fabric ?? "",
                pieces: product.pieces ? String(product.pieces) : "",
                stitching: product.stitching ?? "",
                occasion: product.occasion ?? "",
                imperfections: product.imperfections ?? "",
                condition: product.condition,
                price: (product.priceCents / 100).toFixed(product.priceCents % 100 === 0 ? 0 : 2),
                isFeatured: product.isFeatured,
              }}
            />
          </section>
        </div>

        <div className="space-y-6">
          <section className={cardClass} aria-labelledby="status-heading">
            <h2 id="status-heading" className="mb-3 font-display text-2xl font-medium">
              Status: {STATUS_LABELS[product.status]}
            </h2>
            <StatusPanel
              key={`${product.status}-${product.hold?.id ?? ""}`}
              productId={product.id}
              status={product.status}
              hasPhotos={product.images.length > 0}
              defaultHoldHours={settings.holds.expiryHours}
              hold={
                product.hold && {
                  customerName: product.hold.customerName,
                  customerContact: product.hold.customerContact,
                  note: product.hold.note,
                  heldAt: when(product.hold.heldAt),
                  expiresAt: product.hold.expiresAt ? when(product.hold.expiresAt) : null,
                  endsIn: product.hold.expiresAt ? timeUntil(product.hold.expiresAt) : null,
                }
              }
            />
          </section>

          <section className={cardClass} aria-labelledby="history-heading" data-testid="status-history">
            <h2 id="history-heading" className="font-display text-2xl font-medium">
              History
            </h2>
            <ul className="mt-3 divide-y divide-line text-sm">
              {product.history.map((event) => (
                <li key={event.id} className="py-2.5">
                  <p>
                    {event.fromStatus ? `${STATUS_LABELS[event.fromStatus]} → ${STATUS_LABELS[event.toStatus]}` : "Created as a draft"}
                    {event.note && event.fromStatus ? ` (${event.note})` : ""}
                  </p>
                  <p className="text-xs text-muted">
                    {when(event.createdAt)} · {event.adminName ?? "Automatic"}
                  </p>
                </li>
              ))}
              {product.history.length === 0 && <li className="py-2.5 text-muted">No changes recorded yet.</li>}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}

export default function EditProductPage(props: Props) {
  return (
    <>
      <p className="mb-3 text-sm">
        <Link href="/admin/products" className={linkClass}>
          ← All items
        </Link>
      </p>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <EditProduct {...props} />
      </Suspense>
    </>
  );
}
