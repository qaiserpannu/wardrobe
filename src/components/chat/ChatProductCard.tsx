import Image from "next/image";
import Link from "next/link";
import type { ChatProductCard as Card } from "@/lib/chat";

const STATUS_LABEL = { available: null, pending: "On hold", sold: "Sold" } as const;

/** A product shown inside the chat. Every field comes from the shop's records, not from the assistant's text. */
export function ChatProductCard({ product }: { product: Card }) {
  const status = STATUS_LABEL[product.status];
  return (
    <Link
      href={product.href}
      data-testid="chat-card"
      data-status={product.status}
      className="flex gap-3 rounded-xl border border-line bg-surface p-2 transition-colors hover:border-accent"
    >
      <span className="relative block h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-sand">
        {product.image && (
          <Image
            src={product.image.url}
            alt={product.image.alt}
            fill
            sizes="64px"
            className={`object-cover ${product.status === "sold" ? "opacity-60" : ""}`}
          />
        )}
      </span>
      <span className="min-w-0 flex-1 py-0.5">
        <span className="block truncate text-sm font-medium">{product.name}</span>
        <span className="mt-0.5 block text-xs text-muted">
          {[product.size ? `Size ${product.size}` : null, product.condition].filter(Boolean).join(" · ")}
        </span>
        <span className="mt-1 flex items-center gap-2 text-sm">
          <span className={product.status === "sold" ? "text-muted line-through" : "font-medium"}>{product.price}</span>
          {status && (
            <span className="rounded-full bg-ink px-2 py-0.5 text-[0.6rem] font-semibold tracking-wider text-white uppercase">
              {status}
            </span>
          )}
          <span className="ml-auto text-[0.65rem] text-muted">{product.code}</span>
        </span>
      </span>
    </Link>
  );
}
