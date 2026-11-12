/** Public address of the site, used for absolute links (social previews, WhatsApp messages). */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
