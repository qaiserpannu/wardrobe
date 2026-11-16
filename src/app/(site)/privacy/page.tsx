import type { Metadata } from "next";
import { InfoPage } from "@/components/content/InfoPage";
import { getCachedSettings } from "@/server/services/cached";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What information this shop keeps when you browse or chat, and what it is used for.",
};

export default async function PrivacyPage() {
  const { branding, contact, ai_assistant: assistant } = await getCachedSettings();
  return (
    <InfoPage eyebrow="Your information" title="Privacy">
      <section>
        <h2>The short version</h2>
        <p>
          {branding.siteName} is a small local shop. We keep only what we need to answer you and arrange a sale. We do
          not sell your information, show adverts or use advertising trackers, and this site does not take payments.
        </p>
      </section>
      <section>
        <h2>What we keep</h2>
        <ul>
          <li>
            <strong>Chat messages.</strong> If you use the chat on this site, we keep the conversation, your name if
            you give it, and which items you asked about, so the owner can follow up.
          </li>
          <li>
            <strong>A chat cookie.</strong> A small cookie lets the chat remember your conversation when you come back
            on the same device. It is not used to follow you around other sites.
          </li>
          <li>
            <strong>Visit counts.</strong> We count how many people look at each page, which website sent them here
            and roughly where they are (city). This uses no cookie, and we do not keep your name or network address:
            only a scrambled code that changes every day, so the same person is not counted twice.
          </li>
          <li>
            <strong>WhatsApp, email and phone.</strong> If you contact us that way, we see what those services show
            us, such as your number or address and your message.
          </li>
          <li>
            <strong>Technical records.</strong> Like any website, the companies that host this site keep short-lived
            records of visits (for example network addresses) to keep it running and secure.
          </li>
        </ul>
      </section>
      <section>
        <h2>The chat assistant</h2>
        <p>
          The chat is answered first by {assistant.name}, an automated AI assistant, and by the owner when needed. To
          write its replies, your chat messages are sent to the AI service we use. Please do not put card numbers,
          bank details or other sensitive information in the chat.
        </p>
      </section>
      <section>
        <h2>Who helps us run the site</h2>
        <p>
          The site, its database and its photos are kept with hosting companies in the United States, and chat
          replies are produced with an AI service. They handle information only to provide those services to us.
        </p>
      </section>
      <section>
        <h2>How long, and your choices</h2>
        <p>
          We keep conversations for as long as they are useful for running the shop. You can ask us to show you or
          delete what we hold about you
          {contact.email ? (
            <>
              {" "}
              by emailing <a href={`mailto:${contact.email}`}>{contact.email}</a>
            </>
          ) : (
            " by messaging us on WhatsApp"
          )}
          . You can also browse the shop without using the chat at all.
        </p>
      </section>
      <section>
        <h2>Children</h2>
        <p>This shop is meant for adults. We do not knowingly collect information from children.</p>
      </section>
    </InfoPage>
  );
}
