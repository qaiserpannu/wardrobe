import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeading } from "@/components/admin/PageHeading";
import { StatusPill } from "@/components/admin/StatusPill";
import { requireAdmin } from "@/server/auth/session";
import { getVisitReport, VISIT_PERIODS, type VisitPeriod } from "@/server/services/admin-visits";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Visitors" };

type Search = PageProps<"/admin/visitors">["searchParams"];
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const cardClass = "rounded-2xl border border-line bg-surface p-5 sm:p-6";
const PAGE_NAMES: Record<string, string> = { "/": "Home page", "/shop": "Shop (all items)", "/terms": "How buying works", "/privacy": "Privacy" };

function Stat({ label, value, testId }: { label: string; value: number; testId: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 font-display text-4xl font-medium" data-testid={testId}>
        {value.toLocaleString("en-US")}
      </p>
    </div>
  );
}

/** A plain list with a bar behind each row showing its share of the biggest row. */
function Bars({ rows, empty, testId }: { rows: { label: string; value: number }[]; empty: string; testId: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="space-y-2" data-testid={testId}>
      {rows.map((row) => (
        <li key={row.label} className="relative overflow-hidden rounded-lg border border-line bg-white px-3 py-2 text-sm">
          <span aria-hidden className="absolute inset-y-0 left-0 bg-sand" style={{ width: `${(row.value / max) * 100}%` }} />
          <span className="relative flex justify-between gap-4">
            <span className="min-w-0 break-words">{row.label}</span>
            <span className="font-medium tabular-nums">{row.value.toLocaleString("en-US")}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

async function Visitors({ searchParams }: { searchParams: Search }) {
  await requireAdmin();
  const wanted = Number(first((await searchParams).days));
  const days: VisitPeriod = VISIT_PERIODS.find((p) => p === wanted) ?? 30;
  const settings = await getSettings();
  const report = await getVisitReport(days, settings.shop.timeZone);

  if (!report) {
    return (
      <div className={cardClass} role="status" data-testid="visitors-not-ready">
        <p className="font-medium">Visitor counts are not switched on yet.</p>
        <p className="mt-2 text-sm text-muted">
          The database needs one small update first. On your computer, in the project folder, run{" "}
          <code className="rounded bg-sand px-1.5 py-0.5">npm run db:migrate</code> and then reload this page.
        </p>
      </div>
    );
  }

  const tab = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap ${active ? "bg-accent text-white" : "border border-line bg-white hover:border-accent"}`;
  const peak = Math.max(1, ...report.daily.map((d) => d.visitors));
  const dayLabel = (day: string) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
  const nothingYet = report.period.views === 0 && report.period.whatsapp === 0;

  return (
    <div className="space-y-6">
      <section aria-labelledby="today-heading" className={cardClass}>
        <h2 id="today-heading" className="font-display text-2xl font-medium">
          Today
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat label="Visitors" value={report.today.visitors} testId="today-visitors" />
          <Stat label="Pages viewed" value={report.today.views} testId="today-views" />
          <Stat label="WhatsApp taps" value={report.today.whatsapp} testId="today-whatsapp" />
        </div>
      </section>

      <nav aria-label="Period" className="flex gap-2 overflow-x-auto pb-1" data-testid="visitor-periods">
        {VISIT_PERIODS.map((p) => (
          <Link key={p} href={p === 30 ? "/admin/visitors" : `/admin/visitors?days=${p}`} className={tab(p === days)} aria-current={p === days ? "page" : undefined}>
            Last {p} days
          </Link>
        ))}
      </nav>

      <section aria-labelledby="period-heading" className={cardClass}>
        <h2 id="period-heading" className="font-display text-2xl font-medium">
          Last {days} days
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat label="Visitors" value={report.period.visitors} testId="period-visitors" />
          <Stat label="Pages viewed" value={report.period.views} testId="period-views" />
          <Stat label="WhatsApp taps" value={report.period.whatsapp} testId="period-whatsapp" />
        </div>
        {nothingYet ? (
          <p className="mt-5 text-sm text-muted" data-testid="visitors-empty">
            No visits have been counted in this period yet. Counting starts from the day this page was added; your own visits while
            signed in here are left out.
          </p>
        ) : (
          <>
            <h3 className="mt-6 text-sm font-medium">Visitors each day</h3>
            <div className="mt-3 flex h-32 items-end gap-px sm:gap-0.5" role="img" aria-label={`Visitors each day for the last ${days} days`} data-testid="visitor-chart">
              {report.daily.map((d) => (
                <div
                  key={d.day}
                  title={`${dayLabel(d.day)}: ${d.visitors} ${d.visitors === 1 ? "visitor" : "visitors"}, ${d.views} pages`}
                  className="flex-1 rounded-t-sm bg-accent/80"
                  style={{ height: `${Math.max(d.visitors > 0 ? 6 : 1, (d.visitors / peak) * 100)}%` }}
                />
              ))}
            </div>
            <p className="mt-2 flex justify-between text-xs text-muted">
              <span>{dayLabel(report.daily[0].day)}</span>
              <span>busiest day: {peak}</span>
              <span>{dayLabel(report.daily[report.daily.length - 1].day)}</span>
            </p>
          </>
        )}
      </section>

      <section aria-labelledby="items-heading" className={cardClass}>
        <h2 id="items-heading" className="font-display text-2xl font-medium">
          Most viewed items
        </h2>
        {report.items.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No item has been viewed in this period yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="top-items">
              <thead className="text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th scope="col" className="pb-2 font-medium">Item</th>
                  <th scope="col" className="pb-2 pl-3 text-right font-medium">Views</th>
                  <th scope="col" className="hidden pb-2 pl-3 text-right font-medium sm:table-cell">Visitors</th>
                  <th scope="col" className="pb-2 pl-3 text-right font-medium">
                    WhatsApp<span className="hidden sm:inline"> taps</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {report.items.map((item) => (
                  <tr key={item.id} data-testid="top-item">
                    <td className="py-2.5 pr-3">
                      <Link href={`/admin/products/${item.id}`} className="font-medium text-accent underline-offset-4 hover:underline">
                        {item.name}
                      </Link>
                      <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                        {item.code} <StatusPill status={item.status} />
                      </span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{item.views}</td>
                    <td className="hidden py-2.5 text-right tabular-nums sm:table-cell">{item.visitors}</td>
                    <td className="py-2.5 text-right tabular-nums">{item.whatsapp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="sources-heading" className={cardClass}>
          <h2 id="sources-heading" className="font-display text-2xl font-medium">
            Where visits came from
          </h2>
          <p className="mt-1 mb-4 text-xs text-muted">
            &ldquo;Direct or a shared link&rdquo; means the address was typed, bookmarked, or opened from a message (WhatsApp and
            text messages usually do not say where a link was tapped).
          </p>
          <Bars rows={report.sources.map((s) => ({ label: s.label, value: s.visits }))} empty="Nothing yet." testId="visit-sources" />
        </section>

        <section aria-labelledby="places-heading" className={cardClass}>
          <h2 id="places-heading" className="font-display text-2xl font-medium">
            Where visitors are
          </h2>
          <p className="mt-1 mb-4 text-xs text-muted">An estimate from the visitor&rsquo;s internet connection; phones can show a nearby city.</p>
          <Bars rows={report.places.map((p) => ({ label: p.place, value: p.visitors }))} empty="Nothing yet." testId="visit-places" />
        </section>
      </div>

      <section aria-labelledby="pages-heading" className={cardClass}>
        <h2 id="pages-heading" className="font-display text-2xl font-medium">
          Other pages
        </h2>
        <div className="mt-4">
          <Bars rows={report.pages.map((p) => ({ label: PAGE_NAMES[p.path] ?? p.path, value: p.views }))} empty="Nothing yet." testId="visit-pages" />
        </div>
      </section>
    </div>
  );
}

export default function VisitorsPage({ searchParams }: { searchParams: Search }) {
  return (
    <>
      <PageHeading title="Visitors">
        How many people looked at the shop, which items they opened, and where they came from. Search engines and your own visits while
        signed in are left out. No names or network addresses are kept.
      </PageHeading>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Visitors searchParams={searchParams} />
      </Suspense>
    </>
  );
}
