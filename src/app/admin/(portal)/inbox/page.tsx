import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeading } from "@/components/admin/PageHeading";
import { formatDateTime } from "@/lib/dates";
import { CHANNEL_LABELS, REQUEST_LABELS, STATE_LABELS } from "@/lib/inbox-labels";
import { requireAdmin } from "@/server/auth/session";
import { countWaitingConversations, listInbox } from "@/server/services/admin-inbox";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Inbox" };

type Search = PageProps<"/admin/inbox">["searchParams"];
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

async function Inbox({ searchParams }: { searchParams: Search }) {
  await requireAdmin();
  const raw = await searchParams;
  const filter = first(raw.show) === "all" ? "all" : "waiting";
  const [result, waiting, settings] = await Promise.all([listInbox(filter, Number(first(raw.page)) || 1), countWaitingConversations(), getSettings()]);
  const { locale, timeZone } = settings.shop;
  const assistant = settings.ai_assistant.name;
  const tab = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap ${active ? "bg-accent text-white" : "border border-line bg-white hover:border-accent"}`;
  const href = (page: number) => `/admin/inbox?${filter === "all" ? "show=all&" : ""}page=${page}`;

  return (
    <>
      <nav aria-label="Which conversations" className="flex gap-2" data-testid="inbox-tabs">
        <Link href="/admin/inbox" className={tab(filter === "waiting")} aria-current={filter === "waiting" ? "page" : undefined}>
          Waiting for you ({waiting})
        </Link>
        <Link href="/admin/inbox?show=all" className={tab(filter === "all")} aria-current={filter === "all" ? "page" : undefined}>
          All conversations
        </Link>
      </nav>

      {result.items.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-line bg-surface p-8 text-center text-muted" data-testid="inbox-empty">
          {filter === "waiting" ? "Nobody is waiting for you." : "No conversations yet."}
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-line rounded-2xl border border-line bg-surface" data-testid="inbox-list">
          {result.items.map((item) => (
            <li key={item.id}>
              <Link href={`/admin/inbox/${item.id}`} className="block p-4 hover:bg-sand/60" data-testid="inbox-item">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="font-medium">
                    {item.customerName ?? "Visitor"}
                    {item.customerContact ? <span className="font-normal text-muted"> · {item.customerContact}</span> : null}
                  </p>
                  <p className="text-xs text-muted">
                    {CHANNEL_LABELS[item.channel]} · {formatDateTime(item.lastMessageAt, locale, timeZone)}
                  </p>
                </div>
                {item.waiting.map((request, index) => (
                  <p key={index} className="mt-1.5 text-sm">
                    <span className="mr-2 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">{REQUEST_LABELS[request.reason]}</span>
                    <span className="break-words">{request.question}</span>
                  </p>
                ))}
                {item.lastMessage && (
                  <p className="mt-1.5 line-clamp-2 text-sm break-words text-muted">
                    {item.lastMessage.sender === "customer" ? "Customer" : item.lastMessage.sender === "owner" ? "You" : assistant}: {item.lastMessage.body}
                  </p>
                )}
                {item.waiting.length === 0 && <p className="mt-1 text-xs text-muted">{STATE_LABELS[item.state]}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {result.pageCount > 1 && (
        <nav aria-label="Pages" className="mt-5 flex items-center justify-between text-sm">
          {result.page > 1 ? (
            <Link href={href(result.page - 1)} className="text-accent underline-offset-4 hover:underline">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Page {result.page} of {result.pageCount}
          </span>
          {result.page < result.pageCount ? (
            <Link href={href(result.page + 1)} className="text-accent underline-offset-4 hover:underline">
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}

export default function InboxPage({ searchParams }: { searchParams: Search }) {
  return (
    <>
      <PageHeading title="Inbox">Conversations customers have had in the website chat, and the ones where someone is waiting for you.</PageHeading>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Inbox searchParams={searchParams} />
      </Suspense>
    </>
  );
}
