/**
 * WhatsApp click-to-chat (official wa.me links).
 * This is the only place in the app that builds WhatsApp links.
 * The number always comes from site settings.
 */

export type WhatsAppProduct = { name: string; code: string };

/** Keep digits only: "+1 (555) 010-0199" -> "15550100199". */
export function normalizeWhatsAppNumber(input: string): string {
  return input.replace(/\D/g, "").replace(/^0+/, "");
}

export function isWhatsAppConfigured(number: string): boolean {
  const n = normalizeWhatsAppNumber(number);
  return n.length >= 8 && n.length <= 15;
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/** Returns null when no valid number is configured, so callers can hide the button. */
export function buildWhatsAppLink(number: string, message: string): string | null {
  if (!isWhatsAppConfigured(number)) return null;
  const text = message.trim();
  const base = `https://wa.me/${normalizeWhatsAppNumber(number)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** Link whose pre-filled message names the product and its ID, plus a link back to the item. */
export function buildProductInquiryLink(
  config: { number: string; productMessage: string },
  product: WhatsAppProduct,
  productUrl?: string,
): string | null {
  let message = fill(config.productMessage, { name: product.name, code: product.code });
  // Guarantee the product is identifiable even if the template was edited to drop the placeholders.
  if (!message.includes(product.code)) message += ` (${product.name}, ID: ${product.code})`;
  if (productUrl) message += `\n${productUrl}`;
  return buildWhatsAppLink(config.number, message);
}
