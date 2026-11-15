import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "@/components/content/InfoPage";
import { getCachedSettings } from "@/server/services/cached";

export const metadata: Metadata = {
  title: "How buying works",
  description: "How to buy from the shop: enquiries, holds, pickup in person, payment and final sale.",
};

export default async function TermsPage() {
  const { branding, contact, holds } = await getCachedSettings();
  const days = holds.expiryHours % 24 === 0 ? `${holds.expiryHours / 24} days` : `${holds.expiryHours} hours`;
  return (
    <InfoPage eyebrow="Good to know" title="How buying works">
      <section>
        <h2>Enquire first</h2>
        <p>
          {branding.siteName} has no online checkout. To buy an item, message us on WhatsApp or use the chat on this
          site. Every piece is one of a kind, so an item is yours only once the owner has confirmed it with you
          directly. An enquiry, or a reply from our chat assistant, is not a confirmed sale or hold.
        </p>
      </section>
      <section>
        <h2>Holds</h2>
        <p>
          When the owner agrees to hold an item for you, it is marked “on hold” and kept for up to {days}. If it has
          not been collected or otherwise agreed by then, it goes back on sale.
        </p>
      </section>
      <section>
        <h2>Pickup</h2>
        <p>
          Items are collected in person{contact.location ? ` in ${contact.location}` : ""}, at a time and place agreed
          with the owner. We do not ship.
        </p>
      </section>
      <section>
        <h2>Payment</h2>
        <p>
          Payment is by Zelle, Cash App or cash, arranged directly with the owner. This website never asks for card
          or bank details; if a page or message claiming to be us does, please do not respond to it.
        </p>
      </section>
      <section>
        <h2>Condition and final sale</h2>
        <p>
          Everything here is pre-owned. We describe each item’s condition and show our own photos, and you are welcome
          to look an item over at pickup before paying. All sales are final: there are no returns, refunds or
          exchanges once an item has been paid for and collected.
        </p>
      </section>
      <section>
        <h2>Prices and availability</h2>
        <p>
          Prices are in US dollars. The shop shows what is available at the moment you look; an item can be sold or
          placed on hold at any time before your purchase is confirmed.
        </p>
      </section>
      <section>
        <h2>Questions</h2>
        <p>
          Message us on WhatsApp or through the chat
          {contact.email ? (
            <>
              , or email <a href={`mailto:${contact.email}`}>{contact.email}</a>
            </>
          ) : null}
          . See also our <Link href="/privacy">privacy notice</Link>.
        </p>
      </section>
    </InfoPage>
  );
}
