import type { SiteSettings } from "./settings";

/**
 * A description of the shop in the form search engines read (schema.org).
 * Built only from the owner's settings; anything not filled in is left out.
 */
export function shopJsonLd(settings: SiteSettings, baseUrl: string, heroImage: string | null): Record<string, unknown> {
  const { branding, seo, contact, social } = settings;
  const location = contact.location.trim();
  const links = [social.instagram, social.facebook, social.tiktok].filter((url) => /^https:\/\//.test(url));
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    name: branding.siteName,
    url: `${baseUrl}/`,
    description: seo.description,
    ...(heroImage ? { image: `${baseUrl}${heroImage}` } : {}),
    ...(location ? { areaServed: location, address: { "@type": "PostalAddress", addressLocality: location } } : {}),
    ...(contact.email ? { email: contact.email } : {}),
    ...(links.length ? { sameAs: links } : {}),
  };
}
