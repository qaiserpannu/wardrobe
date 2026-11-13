import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProductArticle } from "@/components/catalog/ProductArticle";
import { formatPrice } from "@/lib/money";
import { STATUS_LABELS } from "@/lib/product-form";
import { requireAdmin } from "@/server/auth/session";
import { getProductPreview } from "@/server/services/admin-products";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Preview" };

type Props = PageProps<"/admin/products/[id]/preview">;

async function Preview({ params }: { params: Props["params"] }) {
  await requireAdmin();
  const { id } = await params;
  const [preview, settings] = await Promise.all([getProductPreview(id), getSettings()]);
  if (!preview) return <p data-testid="admin-not-found">This item could not be found.</p>;
  const { product, realStatus } = preview;
  const hidden = realStatus === "draft" || realStatus === "archived";

  return (
    <>
      <p className="mb-6 rounded-lg border border-gold/60 bg-sand p-4 text-sm" data-testid="preview-notice">
        <strong>Preview.</strong>{" "}
        {hidden
          ? `This item is ${STATUS_LABELS[realStatus].toLowerCase()}, so customers cannot see it. This is how it would look once published.`
          : "This is how customers see this item."}{" "}
        <Link href={`/admin/products/${id}`} className="text-accent underline underline-offset-4">
          Back to editing
        </Link>
      </p>
      <div className="rounded-2xl border border-line bg-canvas p-4 sm:p-8">
        <ProductArticle
          product={product}
          price={formatPrice(product.priceCents, settings.shop.currency, settings.shop.locale)}
          inquiryLink={null}
        />
      </div>
    </>
  );
}

export default function PreviewPage({ params }: Props) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Preview params={params} />
    </Suspense>
  );
}
