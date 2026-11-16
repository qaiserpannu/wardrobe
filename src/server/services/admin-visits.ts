import "server-only";
import { sql } from "drizzle-orm";
import type { ProductStatus } from "@/lib/product-form";
import { VISIT_SOURCES, type VisitSource } from "@/lib/visit-source";
import { getDb } from "@/server/db/client";

/** Admin only: visitor counts for the "Visitors" page (D48). Reads `site_visits`; never writes. */

export const VISIT_PERIODS = [7, 30, 90] as const;
export type VisitPeriod = (typeof VISIT_PERIODS)[number];

export interface VisitTotals {
  /** People, counted once per day they came. */
  visitors: number;
  /** Pages looked at. */
  views: number;
  /** Taps on a WhatsApp button. */
  whatsapp: number;
}

export interface VisitReport {
  today: VisitTotals;
  period: VisitTotals;
  daily: { day: string; visitors: number; views: number }[];
  items: { id: string; code: string; name: string; status: ProductStatus; views: number; visitors: number; whatsapp: number }[];
  sources: { source: VisitSource; label: string; visits: number }[];
  places: { place: string; visitors: number }[];
  pages: { path: string; views: number }[];
}

/** True when the error means the visits table has not been created yet (database update not run). */
function tableMissing(error: unknown): boolean {
  for (let e: unknown = error, i = 0; e && i < 4; e = (e as { cause?: unknown }).cause, i++) {
    if ((e as { code?: string }).code === "42P01") return true;
  }
  return false;
}

const num = (value: unknown) => Number(value) || 0;

/** Null when the database has not been updated for visitor counts yet. */
export async function getVisitReport(days: VisitPeriod, timeZone: string): Promise<VisitReport | null> {
  const db = getDb();
  // Days are the shop's own calendar days, not the server's.
  const local = sql`(created_at at time zone ${timeZone})::date`;
  const today = sql`(now() at time zone ${timeZone})::date`;
  const inPeriod = sql`${local} > ${today} - ${days}::int`;
  try {
    const [totals] = await db.execute(sql`
      select
        count(distinct visitor_hash) filter (where ${local} = ${today}) as today_visitors,
        count(*) filter (where kind = 'view' and ${local} = ${today}) as today_views,
        count(*) filter (where kind = 'whatsapp' and ${local} = ${today}) as today_whatsapp,
        count(distinct visitor_hash) as visitors,
        count(*) filter (where kind = 'view') as views,
        count(*) filter (where kind = 'whatsapp') as whatsapp
      from site_visits where ${inPeriod}`);

    const daily = await db.execute(sql`
      select to_char(d.day, 'YYYY-MM-DD') as day, coalesce(v.visitors, 0) as visitors, coalesce(v.views, 0) as views
      from generate_series(${today} - (${days}::int - 1), ${today}, interval '1 day') as d(day)
      left join (
        select ${local} as day, count(distinct visitor_hash) as visitors, count(*) filter (where kind = 'view') as views
        from site_visits where ${inPeriod} group by 1
      ) v on v.day = d.day::date
      order by d.day`);

    const items = await db.execute(sql`
      select p.id, p.code, p.name, p.status,
        count(*) filter (where v.kind = 'view') as views,
        count(distinct v.visitor_hash) as visitors,
        count(*) filter (where v.kind = 'whatsapp') as whatsapp
      from site_visits v join products p on p.id = v.product_id
      where ${sql`(v.created_at at time zone ${timeZone})::date`} > ${today} - ${days}::int
      group by p.id order by views desc, whatsapp desc, p.code limit 15`);

    const sources = await db.execute(sql`
      select source, count(*) as visits from site_visits
      where source is not null and ${inPeriod} group by source order by visits desc`);

    const places = await db.execute(sql`
      select city, region, country, count(distinct visitor_hash) as visitors from site_visits
      where kind = 'view' and ${inPeriod} group by city, region, country order by visitors desc limit 12`);

    const pages = await db.execute(sql`
      select path, count(*) as views from site_visits
      where kind = 'view' and product_id is null and ${inPeriod} group by path order by views desc`);

    return {
      today: { visitors: num(totals?.today_visitors), views: num(totals?.today_views), whatsapp: num(totals?.today_whatsapp) },
      period: { visitors: num(totals?.visitors), views: num(totals?.views), whatsapp: num(totals?.whatsapp) },
      daily: daily.map((r) => ({ day: String(r.day), visitors: num(r.visitors), views: num(r.views) })),
      items: items.map((r) => ({
        id: String(r.id),
        code: String(r.code),
        name: String(r.name),
        status: r.status as ProductStatus,
        views: num(r.views),
        visitors: num(r.visitors),
        whatsapp: num(r.whatsapp),
      })),
      sources: sources.map((r) => {
        const source = (String(r.source) in VISIT_SOURCES ? String(r.source) : "other") as VisitSource;
        return { source, label: VISIT_SOURCES[source], visits: num(r.visits) };
      }),
      places: places.map((r) => ({
        place: [r.city, r.region, r.country].filter(Boolean).join(", ") || "Unknown",
        visitors: num(r.visitors),
      })),
      pages: pages.map((r) => ({ path: String(r.path), views: num(r.views) })),
    };
  } catch (error) {
    if (tableMissing(error)) return null;
    throw error;
  }
}

/** Views and WhatsApp taps for one item over the last `days` days. Null if counts are not set up yet. */
export async function getProductVisitTotals(productId: string, days = 30): Promise<VisitTotals | null> {
  try {
    const [row] = await getDb().execute(sql`
      select count(distinct visitor_hash) as visitors,
             count(*) filter (where kind = 'view') as views,
             count(*) filter (where kind = 'whatsapp') as whatsapp
      from site_visits where product_id = ${productId}::uuid and created_at > now() - make_interval(days => ${days}::int)`);
    return { visitors: num(row?.visitors), views: num(row?.views), whatsapp: num(row?.whatsapp) };
  } catch (error) {
    if (tableMissing(error)) return null;
    throw error;
  }
}
