import { CONDITION_LABELS, type Condition } from "./conditions";
import { formatPrice } from "./money";

export interface ShareListingInput {
  code: string;
  name: string;
  description: string;
  priceCents: number;
  condition: Condition;
  brand?: string | null;
  size?: string | null;
  color?: string | null;
  fabric?: string | null;
  pieces?: number | null;
  imperfections?: string | null;
  /** Full address of the item's page on the shop. */
  url: string;
  currency: string;
  locale: string;
  /** Where items are collected, e.g. "Tampa, FL". Left out when empty. */
  location?: string;
}

export interface ShareListing {
  title: string;
  text: string;
}

/**
 * The words for a listing on Facebook Marketplace, Instagram or a message,
 * written only from what is saved on the item. Nothing is invented: a detail
 * that is not filled in is simply left out.
 */
export function buildShareListing(item: ShareListingInput): ShareListing {
  const price = formatPrice(item.priceCents, item.currency, item.locale);
  const clean = (value?: string | null) => value?.trim() || "";

  const facts = [
    clean(item.brand),
    clean(item.size) && `Size ${clean(item.size)}`,
    CONDITION_LABELS[item.condition],
    clean(item.color),
    clean(item.fabric),
    item.pieces ? `${item.pieces} piece${item.pieces === 1 ? "" : "s"}` : "",
  ].filter(Boolean);

  const lines = [`${item.name.trim()} - ${price}`, facts.join(" · ")];
  if (clean(item.description)) lines.push("", clean(item.description));
  // "None", "None noticed", "N/A" and the like are not worth a line in an advert.
  const flaws = clean(item.imperfections);
  if (flaws && !/^(none|no\b|n\/?a\b|nil\b|-+$)/i.test(flaws)) lines.push("", `Please note: ${flaws}`);
  lines.push("", clean(item.location) ? `Pre-owned. Pickup in ${clean(item.location)}.` : "Pre-owned. Pickup in person.");
  lines.push(`More photos and details: ${item.url}`, `Item ${item.code}`);

  return { title: `${item.name.trim()} - ${price}`, text: lines.join("\n") };
}
