import type { Metadata } from "next";
import { Suspense } from "react";
import { KnowledgeManager } from "@/components/admin/KnowledgeManager";
import { PageHeading } from "@/components/admin/PageHeading";
import { SettingsSectionForm } from "@/components/admin/SettingsSectionForm";
import { sectionFormValues, SETTINGS_SECTIONS } from "@/lib/settings-form";
import { isAgentConfigured } from "@/server/agent/providers";
import { requireAdmin } from "@/server/auth/session";
import { countCustomerMessagesLastDay } from "@/server/services/admin-inbox";
import { listKnowledge } from "@/server/services/admin-knowledge";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Assistant" };

const cardClass = "rounded-2xl border border-line bg-surface p-5 sm:p-6";

async function Assistant() {
  await requireAdmin();
  const [settings, knowledge, today] = await Promise.all([
    getSettings(),
    listKnowledge(),
    countCustomerMessagesLastDay(),
  ]);
  const section = SETTINGS_SECTIONS.find((s) => s.id === "assistant")!;
  const configured = isAgentConfigured();
  const { enabled, name, dailyMessageLimit } = settings.ai_assistant;
  const status = !configured
    ? { text: "Not connected: no AI key is set on the server, so the chat button opens WhatsApp instead.", ok: false }
    : !enabled
      ? { text: "Switched off: the chat button opens WhatsApp instead.", ok: false }
      : { text: `${name} is answering customers in the website chat.`, ok: true };

  return (
    <div className="max-w-3xl space-y-6">
      <section className={cardClass} data-testid="assistant-status">
        <p className="flex items-start gap-3">
          <span aria-hidden className={`mt-1.5 size-2.5 shrink-0 rounded-full ${status.ok ? "bg-whatsapp" : "bg-gold"}`} />
          <span>{status.text}</span>
        </p>
        <p className="mt-2 text-sm text-muted" data-testid="assistant-usage">
          Customer messages in the last 24 hours: {today} of {dailyMessageLimit} allowed.
        </p>
      </section>

      <section className={cardClass} aria-labelledby="behaviour-heading">
        <h2 id="behaviour-heading" className="mb-5 font-display text-2xl font-medium">
          {section.title}
        </h2>
        <SettingsSectionForm sectionId={section.id} values={sectionFormValues(section, settings)} />
      </section>

      <section className={cardClass} aria-labelledby="knowledge-heading">
        <h2 id="knowledge-heading" className="font-display text-2xl font-medium">
          Shop information
        </h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          The only facts about the shop {name} is allowed to state, apart from what is in each item. If a customer asks something that is not
          here, she says she will check and passes the question to your inbox.
        </p>
        <KnowledgeManager items={knowledge} />
      </section>
    </div>
  );
}

export default function AssistantPage() {
  return (
    <>
      <PageHeading title="Assistant">Switch the chat assistant on or off, set how she speaks, and decide what she may tell customers.</PageHeading>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Assistant />
      </Suspense>
    </>
  );
}
