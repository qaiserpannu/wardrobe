import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ConversationActions } from "@/components/admin/ConversationActions";
import { PageHeading } from "@/components/admin/PageHeading";
import { formatDateTime } from "@/lib/dates";
import { CHANNEL_LABELS, REQUEST_LABELS, STAGE_LABELS, STATE_LABELS } from "@/lib/inbox-labels";
import { STATUS_LABELS, type ProductStatus } from "@/lib/product-form";
import { requireAdmin } from "@/server/auth/session";
import { getInboxConversation } from "@/server/services/admin-inbox";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Conversation" };

type Props = PageProps<"/admin/inbox/[id]">;
const cardClass = "rounded-2xl border border-line bg-surface p-5 sm:p-6";
const linkClass = "text-accent underline-offset-4 hover:underline";

async function Conversation({ params }: { params: Props["params"] }) {
  await requireAdmin();
  const { id } = await params;
  const [conversation, settings] = await Promise.all([getInboxConversation(id), getSettings()]);
  if (!conversation) {
    return (
      <p className={cardClass} data-testid="admin-not-found">
        This conversation could not be found.
      </p>
    );
  }
  const { locale, timeZone } = settings.shop;
  const when = (date: Date) => formatDateTime(date, locale, timeZone);
  const assistant = settings.ai_assistant.name;
  const open = conversation.requests.filter((r) => !r.resolvedAt);
  const speaker = { customer: conversation.customer.name ?? "Customer", agent: assistant, owner: "You", system: "Automatic message" } as const;

  return (
    <>
      <PageHeading title={conversation.customer.name ?? "Visitor"}>
        {CHANNEL_LABELS[conversation.channel]} · started {when(conversation.startedAt)} · <span data-testid="conversation-state">{STATE_LABELS[conversation.state]}</span>
        {conversation.customer.contact ? ` · Contact: ${conversation.customer.contact}` : ""}
      </PageHeading>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <section className={cardClass} aria-label="Messages">
            <ol className="space-y-4" data-testid="thread">
              {conversation.messages.map((message) => {
                const fromCustomer = message.sender === "customer";
                return (
                  <li key={message.id} className={`flex flex-col ${fromCustomer ? "items-start" : "items-end"}`} data-testid={`thread-${message.sender}`}>
                    <p className="mb-1 text-xs text-muted">
                      {speaker[message.sender]} · {when(message.createdAt)}
                    </p>
                    <p
                      dir="auto"
                      className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-line ${
                        fromCustomer ? "bg-sand" : message.sender === "owner" ? "bg-accent text-white" : message.sender === "system" ? "border border-dashed border-line text-muted" : "border border-line bg-white"
                      }`}
                    >
                      {message.body}
                    </p>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className={cardClass} aria-label="Your reply">
            <ConversationActions
              conversationId={conversation.id}
              canReply={conversation.channel === "web"}
              ownerHasTakenOver={conversation.state === "owner"}
              waitingCount={open.length}
              assistantName={assistant}
            />
          </section>
        </div>

        <div className="space-y-6">
          <section className={cardClass} data-testid="conversation-requests">
            <h2 className="font-display text-2xl font-medium">Waiting for you</h2>
            {open.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Nothing is waiting in this conversation.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {open.map((request) => (
                  <li key={request.id} className="text-sm">
                    <p className="text-xs font-semibold tracking-wide text-accent uppercase">{REQUEST_LABELS[request.reason]}</p>
                    <p className="mt-1 break-words">{request.question}</p>
                    <p className="mt-1 text-xs text-muted">{when(request.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={cardClass} data-testid="conversation-interest">
            <h2 className="font-display text-2xl font-medium">Items they asked about</h2>
            {conversation.interest.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No buying interest recorded.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {conversation.interest.map((lead) => (
                  <li key={lead.id} className="py-3 text-sm">
                    <Link href={`/admin/products/${lead.productId}`} className={`font-medium ${linkClass}`}>
                      {lead.productCode} {lead.productName}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted">
                      {STAGE_LABELS[lead.stage]} · now {STATUS_LABELS[lead.productStatus as ProductStatus].toLowerCase()}
                    </p>
                    <p className="mt-1 break-words">{lead.summary}</p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted">Nothing is reserved automatically. Open the item to put it on hold or mark it sold.</p>
          </section>
        </div>
      </div>
    </>
  );
}

export default function ConversationPage({ params }: Props) {
  return (
    <>
      <p className="mb-3 text-sm">
        <Link href="/admin/inbox" className={linkClass}>
          ← Inbox
        </Link>
      </p>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Conversation params={params} />
      </Suspense>
    </>
  );
}
