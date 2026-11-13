import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeading } from "@/components/admin/PageHeading";
import { formatDateTime } from "@/lib/dates";
import { requireAdmin } from "@/server/auth/session";
import { AUDIT_AREAS, type AuditArea, listAudit } from "@/server/services/audit";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Activity" };

type Search = PageProps<"/admin/activity">["searchParams"];
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const AREAS = Object.keys(AUDIT_AREAS) as AuditArea[];

async function Activity({ searchParams }: { searchParams: Search }) {
  await requireAdmin();
  const raw = await searchParams;
  const area = AREAS.find((a) => a === first(raw.area));
  const [result, settings] = await Promise.all([listAudit({ area, page: Number(first(raw.page)) || 1 }), getSettings()]);
  const { locale, timeZone } = settings.shop;
  const href = (target: AuditArea | undefined, page = 1) => {
    const query = new URLSearchParams();
    if (target) query.set("area", target);
    if (page > 1) query.set("page", String(page));
    const text = query.toString();
    return text ? `/admin/activity?${text}` : "/admin/activity";
  };
  const tab = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap ${active ? "bg-accent text-white" : "border border-line bg-white hover:border-accent"}`;

  return (
    <>
      <nav aria-label="Filter by area" className="flex gap-2 overflow-x-auto pb-1" data-testid="activity-tabs">
        <Link href={href(undefined)} className={tab(!area)} aria-current={!area ? "page" : undefined}>
          Everything
        </Link>
        {AREAS.map((a) => (
          <Link key={a} href={href(a)} className={tab(area === a)} aria-current={area === a ? "page" : undefined}>
            {AUDIT_AREAS[a].label}
          </Link>
        ))}
      </nav>
      <p className="mt-5 text-sm text-muted" data-testid="activity-count">
        {result.total} {result.total === 1 ? "entry" : "entries"}
      </p>
      {result.items.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-line bg-surface p-8 text-center text-muted">Nothing recorded here yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface px-4 sm:px-5" data-testid="activity-list">
          {result.items.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 text-sm" data-testid="activity-entry">
              <span className="min-w-0 break-words">{entry.summary}</span>
              <span className="text-xs text-muted">
                {entry.adminName ?? "Automatic"} · {formatDateTime(entry.createdAt, locale, timeZone)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {result.pageCount > 1 && (
        <nav aria-label="Pages" className="mt-5 flex items-center justify-between text-sm">
          {result.page > 1 ? (
            <Link href={href(area, result.page - 1)} className="text-accent underline-offset-4 hover:underline">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Page {result.page} of {result.pageCount}
          </span>
          {result.page < result.pageCount ? (
            <Link href={href(area, result.page + 1)} className="text-accent underline-offset-4 hover:underline">
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

export default function ActivityPage({ searchParams }: { searchParams: Search }) {
  return (
    <>
      <PageHeading title="Activity">
        A permanent record of every change made in the admin portal, every sign-in, and anything the system did by itself. Entries cannot be
        edited or removed.
      </PageHeading>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Activity searchParams={searchParams} />
      </Suspense>
    </>
  );
}
