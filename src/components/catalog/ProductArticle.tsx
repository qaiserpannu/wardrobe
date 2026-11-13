import { ButtonLink } from "@/components/ui/ButtonLink";
import { WhatsAppIcon } from "@/components/ui/icons";
import { CONDITION_DESCRIPTIONS, CONDITION_LABELS } from "@/lib/conditions";
import { OCCASION_LABELS, STITCHING_LABELS, piecesLabel } from "@/lib/product-options";
import type { PublicProduct } from "@/server/services/types";
import { ProductGallery } from "./ProductGallery";
import { AvailableBadge, OnHoldBadge, SoldBadge } from "./StatusBadge";

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line py-3 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className={`text-right ${value ? "font-medium" : "text-muted"}`}>{value ?? "Not specified"}</dd>
    </div>
  );
}

type Props = {
  product: PublicProduct;
  /** Already formatted for display. */
  price: string;
  /** WhatsApp link for asking about the item; null when it cannot be bought or no number is set. */
  inquiryLink: string | null;
};

/** Photos and details of one item: the product page, and the admin preview of it. */
export function ProductArticle({ product, price, inquiryLink }: Props) {
  const sold = product.status === "sold";
  const onHold = product.status === "pending";
  return (
    <article className="grid gap-8 lg:grid-cols-2 lg:gap-14" data-testid="product-detail" data-status={product.status}>
      <ProductGallery images={product.images} sold={sold} />

      <div className="lg:py-2">
        {product.brand && <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">{product.brand}</p>}
        <h1 className="mt-2 font-display text-4xl leading-tight font-medium sm:text-5xl">{product.name}</h1>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <p className={`text-2xl font-medium ${sold ? "text-muted line-through" : ""}`} data-testid="product-price">
            {price}
          </p>
          {sold ? <SoldBadge /> : onHold ? <OnHoldBadge /> : <AvailableBadge />}
        </div>

        {product.description && <p className="mt-6 max-w-prose leading-relaxed text-muted">{product.description}</p>}

        <dl className="mt-8 border-t border-line">
          <Detail label="Brand" value={product.brand} />
          <Detail label="Size" value={product.size} />
          <Detail label="Colour" value={product.color} />
          <Detail label="Fabric" value={product.fabric} />
          <Detail label="Pieces" value={product.pieces ? piecesLabel(product.pieces) : null} />
          <Detail label="Stitching" value={product.stitching ? STITCHING_LABELS[product.stitching] : null} />
          <Detail label="Occasion" value={product.occasion ? OCCASION_LABELS[product.occasion] : null} />
          <Detail label="Condition" value={CONDITION_LABELS[product.condition]} />
          <Detail
            label="Category"
            value={product.group ? `${product.group.name} · ${product.category.name}` : product.category.name}
          />
          <Detail label="Product ID" value={product.code} />
        </dl>
        <p className="mt-3 text-xs text-muted">
          {CONDITION_LABELS[product.condition]}: {CONDITION_DESCRIPTIONS[product.condition]}
        </p>

        <section
          aria-labelledby="imperfections-heading"
          className="mt-6 rounded-sm border border-gold/50 bg-sand p-5"
          data-testid="imperfections"
        >
          <h2 id="imperfections-heading" className="text-xs font-semibold tracking-[0.18em] uppercase">
            Imperfections
          </h2>
          {product.imperfections ? (
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{product.imperfections}</p>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-muted">
              No imperfections have been recorded for this item. Please ask if you would like more detail or
              extra photos.
            </p>
          )}
        </section>

        <div className="mt-8">
          {sold ? (
            <div className="rounded-sm border border-line bg-sand p-5" data-testid="sold-notice">
              <p className="font-medium">This item has been sold.</p>
              <p className="mt-1 text-sm text-muted">Every piece is one of a kind, but similar items may be available.</p>
              <ButtonLink href={`/shop?category=${product.category.slug}&hideSold=1`} variant="outline" className="mt-4">
                Browse available {product.category.name.toLowerCase()}
              </ButtonLink>
            </div>
          ) : onHold ? (
            <div className="rounded-sm border border-line bg-sand p-5" data-testid="hold-notice">
              <p className="font-medium">This item is on hold for another customer.</p>
              <p className="mt-1 text-sm text-muted">
                It may become available again if the sale does not go ahead, so do check back.
              </p>
              <ButtonLink href={`/shop?category=${product.category.slug}&hideSold=1`} variant="outline" className="mt-4">
                Browse available {product.category.name.toLowerCase()}
              </ButtonLink>
            </div>
          ) : inquiryLink ? (
            <>
              <ButtonLink href={inquiryLink} variant="whatsapp" external className="w-full sm:w-auto">
                <WhatsAppIcon /> Ask about this item on WhatsApp
              </ButtonLink>
              <p className="mt-3 text-xs text-muted">
                Opens WhatsApp with a message that mentions this item ({product.code}).
              </p>
            </>
          ) : (
            <p className="rounded-sm border border-line bg-sand p-5 text-sm text-muted" data-testid="whatsapp-unavailable">
              To ask about this item, please quote product ID <strong className="text-ink">{product.code}</strong>.
              WhatsApp contact is being set up.
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
