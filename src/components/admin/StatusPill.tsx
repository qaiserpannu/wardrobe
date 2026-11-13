import type { ProductStatus } from "@/server/services/admin-dashboard";

export const STATUS_LABELS: Record<ProductStatus, string> = {
  draft: "Draft",
  available: "Available",
  pending: "On hold",
  sold: "Sold",
  archived: "Archived",
};

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
