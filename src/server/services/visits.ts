import "server-only";
import { createHash } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { classifySource, countablePath, isAutomatedVisitor, type VisitPlace } from "@/lib/visit-source";
import { getDb } from "@/server/db/client";
import { categories, products } from "@/server/db/schema";

/**
 * Counting visits for the admin "Visitors" page (D48). This is the only code
 * that writes to `site_visits`. It stores no cookie, name or network address:
 * the address is only used, mixed with a secret and today's date, to make a
 * code that tells two visitors apart for that one day.
 */

export interface VisitInput {
  kind: "view" | "whatsapp";
  /** Path plus query string as the browser saw it, e.g. "/shop/red-suit?fbclid=1". */
  url: string;
  /** The page the visitor came from; only sent for the first page of a visit. */
  referrer?: string;
  /** True for the first page of a visit. */
  entry: boolean;
  address: string;
  userAgent: string | null;
  ownHost: string;
  place: VisitPlace;
  now?: Date;
}

/** Looking at the same page again within this time is not counted twice. */
const REPEAT_MINUTES = 30;
/** Counts older than this are removed. */
const KEEP_DAYS = 400;

function visitorCode(address: string, userAgent: string, now: Date): string {
  const secret = process.env.VISIT_SALT || process.env.DATABASE_URL || "";
  const day = now.toISOString().slice(0, 10);
  return createHash("sha256").update(`${secret}|${day}|${address}|${userAgent}`).digest("hex").slice(0, 32);
}

/** Returns true when a row was written. Never throws: counting must not break a page. */
export async function recordVisit(input: VisitInput): Promise<boolean> {
  try {
    if (isAutomatedVisitor(input.userAgent)) return false;
    let url: URL;
    try {
      url = new URL(input.url, "http://site.invalid");
    } catch {
      return false;
    }
    const page = countablePath(url.pathname);
    if (!page) return false;

    const db = getDb();
    let productId: string | null = null;
    if (page.slug) {
      const [product] = await db
        .select({ id: products.id })
        .from(products)
        .innerJoin(categories, eq(products.categoryId, categories.id))
        .where(and(eq(products.slug, page.slug), inArray(products.status, ["available", "pending", "sold"]), eq(categories.isActive, true)))
        .limit(1);
      if (!product) return false;
      productId = product.id;
    }

    const now = input.now ?? new Date();
    const origin = input.kind === "view" && input.entry ? classifySource(input.referrer, url.search, input.ownHost) : null;
    const visitor = visitorCode(input.address, input.userAgent ?? "", now);
    const since = new Date(now.getTime() - REPEAT_MINUTES * 60_000);

    const written = await db.execute(sql`
      insert into site_visits (kind, path, product_id, source, referrer_host, country, region, city, visitor_hash, created_at)
      select ${input.kind}::visit_kind, ${page.path}, ${productId}::uuid, ${origin?.source ?? null}, ${origin?.host?.slice(0, 100) ?? null},
             ${input.place.country}, ${input.place.region}, ${input.place.city}, ${visitor}, ${now.toISOString()}::timestamptz
      where not exists (
        select 1 from site_visits
        where visitor_hash = ${visitor} and path = ${page.path} and kind = ${input.kind}::visit_kind
          and created_at > ${since.toISOString()}::timestamptz
      )
      returning id`);

    // Now and then, clear out counts too old to be useful.
    if (Math.random() < 0.01) {
      await db.execute(sql`delete from site_visits where created_at < now() - make_interval(days => ${KEEP_DAYS})`);
    }
    return written.length > 0;
  } catch {
    return false;
  }
}
