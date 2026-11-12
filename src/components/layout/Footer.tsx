import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from "@/components/ui/icons";
import { buildWhatsAppLink } from "@/integrations/whatsapp";
import { getCachedCategories, getCachedSettings } from "@/server/services/cached";

/** Only http(s) links are rendered, so a mistyped setting can never become a script link. */
function safeUrl(url: string): string | null {
  return /^https?:\/\//i.test(url) ? url : null;
}

async function CopyrightYear() {
  "use cache";
  return new Date().getFullYear();
}

export async function Footer() {
  const [settings, categories] = await Promise.all([getCachedSettings(), getCachedCategories()]);
  const { branding, contact, social, whatsapp } = settings;
  const whatsappLink = buildWhatsAppLink(whatsapp.number, whatsapp.generalMessage);
  const socials = [
    { label: "Instagram", url: safeUrl(social.instagram), Icon: InstagramIcon },
    { label: "Facebook", url: safeUrl(social.facebook), Icon: FacebookIcon },
    { label: "TikTok", url: safeUrl(social.tiktok), Icon: TikTokIcon },
  ].filter((s) => s.url);

  return (
    <footer id="contact" className="mt-24 bg-accent-dark text-[#f6ead6]">
      <div className="edge-scallop" aria-hidden />
      <Container className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <p className="font-display text-2xl font-semibold text-gold-light">{branding.siteName}</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#f6ead6]/70">{branding.tagline}</p>
        </div>

        <nav aria-label="Shop categories">
          <h2 className="text-xs font-semibold tracking-[0.18em] text-gold-light uppercase">Shop</h2>
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
            <li>
              <Link href="/shop" className="hover:text-gold-light">
                All items
              </Link>
            </li>
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/shop?category=${c.slug}`} className="hover:text-gold-light">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-xs font-semibold tracking-[0.18em] text-gold-light uppercase">Contact</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {whatsappLink && (
              <li>
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:text-gold-light"
                >
                  <WhatsAppIcon className="size-4" /> Chat on WhatsApp
                </a>
              </li>
            )}
            {contact.email && (
              <li>
                <a href={`mailto:${contact.email}`} className="hover:text-gold-light">
                  {contact.email}
                </a>
              </li>
            )}
            {contact.phone && (
              <li>
                <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="hover:text-gold-light">
                  {contact.phone}
                </a>
              </li>
            )}
            {contact.location && <li className="text-[#f6ead6]/70">{contact.location}</li>}
            {!whatsappLink && !contact.email && !contact.phone && (
              <li className="text-[#f6ead6]/70">Contact details coming soon.</li>
            )}
          </ul>
        </div>

        {socials.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold tracking-[0.18em] text-gold-light uppercase">Follow</h2>
            <ul className="mt-4 flex gap-3">
              {socials.map(({ label, url, Icon }) => (
                <li key={label}>
                  <a
                    href={url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex size-11 items-center justify-center rounded-full border border-gold/50 hover:border-gold-light hover:text-gold-light"
                  >
                    <Icon />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Container>
      <div className="border-t border-gold/25">
        <Container className="py-5 text-xs text-[#f6ead6]/70">
          © <CopyrightYear /> {branding.siteName}. All rights reserved.
        </Container>
      </div>
    </footer>
  );
}
