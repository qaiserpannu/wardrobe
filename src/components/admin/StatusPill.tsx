import { type ProductStatus, STATUS_LABELS } from "@/lib/product-form";

const STYLES: Record<ProductStatus, string> = {
  draft: "bg-sand text-ink",
  available: "bg-whatsapp/10 text-whatsapp-dark",
  pending: "bg-gold-light/60 text-ink",
  sold: "bg-accent/10 text-accent",
  archived: "bg-line/60 text-muted",
};

export function StatusPill({ status }: { status: ProductStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
