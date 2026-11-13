import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeading } from "@/components/admin/PageHeading";
import { StatusPill } from "@/components/admin/StatusPill";
import { REQUEST_LABELS } from "@/lib/inbox-labels";
import { formatPrice } from "@/lib/money";
import { STATUS_LABELS } from "@/lib/product-form";
import { requireAdmin } from "@/server/auth/session";
import {
  countProductsByStatus,
  countWaitingRequests,
  listRecentlyChangedProducts,
  listWaitingRequests,
} from "@/server/services/admin-dashboard";
import { listRecentAudit } from "@/server/services/audit";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Dashboard" };

const COUNT_ORDER = ["available", "pending", "sold", "draft", "archived"] as const;

function when(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

const cardClass = "rounded-2xl border border-line bg-surface p-5 sm:p-6";
const emptyClass = "py-4 text-sm text-muted";

async function Dashboard() {
  const admin = await requireAdmin();
  const [counts, waitingCount, waiting, recent, changes, settings] = await Promise.all([
    countProductsByStatus(),
    countWaitingRequests(),
    listWaitingRequests(),
    listRecentlyChangedProducts(),
    listRecentAudit(8),
    getSettings(),
  ]);
  const { currency, locale } = settings.shop;

  return (
    <>
      <PageHeading title={`Welcome, ${admin.name}`}>Here is where the shop stands right now.</PageHeading>

      <section aria-label="Items by status" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5" data-testid="status-counts">
        {COUNT_ORDER.map((status) => (
          <div key={status} className={cardClass} data-testid={`count-${status}`}>
            <p className="text-sm text-muted">{STATUS_LABELS[status]}</p>
            <p className="mt-1 font-display text-4xl font-medium">{counts[status]}</p>
          </div>
        ))}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className={cardClass} data-testid="waiting-requests">
          <h2 className="font-display text-2xl font-medium">
            Waiting for you{" "}
            <span className="font-sans text-base text-muted" data-testid="waiting-count">
              ({waitingCount})
            </span>
          </h2>
          {waiting.length === 0 ? (
            <p className={emptyClass}>No customer is waiting for an answer.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {waiting.map((item) => (
                <li key={item.id} className="py-3">
                  <p className="text-xs font-semibold tracking-wide text-accent uppercase">{REQUEST_LABELS[item.reason]}</p>
                  <Link href={`/admin/inbox/${item.conversationId}`} className="mt-1 block text-sm break-words hover:text-accent">
                    {item.question}
                  </Link>
                  <p className="mt-1 text-xs text-muted">
                    {item.customerName ?? "Visitor"} · {item.channel === "web" ? "Website chat" : "WhatsApp"} · {when(item.createdAt, locale)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={cardClass} data-testid="recent-products">
          <h2 className="font-display text-2xl font-medium">Recently changed items</h2>
          {recent.length === 0 ? (
            <p className={emptyClass}>No items yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {recent.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link href={`/admin/products/${item.id}`} className="block truncate text-sm font-medium hover:text-accent">
                      {item.name}
                    </Link>
                    <p className="text-xs text-muted">
                      {item.code} · {item.category} · {formatPrice(item.priceCents, currency, locale)}
                    </p>
                  </div>
                  <StatusPill status={item.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`${cardClass} xl:col-span-2`} data-testid="recent-activity">
          <h2 className="font-display text-2xl font-medium">
            Recent activity{" "}
            <Link href="/admin/activity" className="font-sans text-sm text-accent underline-offset-4 hover:underline">
              See all
            </Link>
          </h2>
          {changes.length === 0 ? (
            <p className={emptyClass}>Nothing recorded yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {changes.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
                  <span>{entry.summary}</span>
                  <span className="text-xs text-muted">{when(entry.createdAt, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Dashboard />
    </Suspense>
  );
}
