import { CONDITIONS, type Condition } from "./conditions";

export const SORTS = ["newest", "price_asc", "price_desc"] as const;
export type Sort = (typeof SORTS)[number];

export const SORT_LABELS: Record<Sort, string> = {
  newest: "Newest arrivals",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
};

export const PAGE_SIZE = 12;

export type CatalogFilters = {
  q: string;
  category: string | null;
  sizes: string[];
  brands: string[];
  conditions: Condition[];
  minPriceCents: number | null;
  maxPriceCents: number | null;
  hideSold: boolean;
  sort: Sort;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

function many(v: string | string[] | undefined): string[] {
  const list = v === undefined ? [] : Array.isArray(v) ? v : [v];
  return [...new Set(list.map((s) => s.trim()).filter((s) => s.length > 0 && s.length <= 60))].slice(0, 30);
}

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

/** Whole currency units from the URL (e.g. "30" or "29.50") to cents. Invalid input is ignored. */
function priceToCents(v: string): number | null {
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(v)) return null;
  return Math.round(Number(v) * 100);
}

/** Turn untrusted URL query values into a safe, fully-typed filter object. */
export function parseCatalogParams(raw: RawParams): CatalogFilters {
  const sort = one(raw.sort) as Sort;
  const page = Number.parseInt(one(raw.page), 10);
  let min = priceToCents(one(raw.min));
  let max = priceToCents(one(raw.max));
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  const category = one(raw.category);
  return {
    q: one(raw.q).slice(0, 100),
    category: /^[a-z0-9-]{1,60}$/.test(category) ? category : null,
    sizes: many(raw.size),
    brands: many(raw.brand),
    conditions: many(raw.condition).filter((c): c is Condition =>
      (CONDITIONS as readonly string[]).includes(c),
    ),
    minPriceCents: min,
    maxPriceCents: max,
    hideSold: one(raw.hideSold) === "1",
    sort: SORTS.includes(sort) ? sort : "newest",
    page: Number.isFinite(page) && page > 0 && page < 10000 ? page : 1,
  };
}

/** Build a catalog URL from filters, leaving out anything at its default value. */
export function catalogHref(filters: Partial<CatalogFilters>): string {
  const p = new URLSearchParams();
  if (filters.q) p.set("q", filters.q);
  if (filters.category) p.set("category", filters.category);
  filters.sizes?.forEach((s) => p.append("size", s));
  filters.brands?.forEach((b) => p.append("brand", b));
  filters.conditions?.forEach((c) => p.append("condition", c));
  if (filters.minPriceCents != null) p.set("min", String(filters.minPriceCents / 100));
  if (filters.maxPriceCents != null) p.set("max", String(filters.maxPriceCents / 100));
  if (filters.hideSold) p.set("hideSold", "1");
  if (filters.sort && filters.sort !== "newest") p.set("sort", filters.sort);
  if (filters.page && filters.page > 1) p.set("page", String(filters.page));
  const qs = p.toString();
  return qs ? `/shop?${qs}` : "/shop";
}

export function countActiveFilters(f: CatalogFilters): number {
  return (
    (f.q ? 1 : 0) +
    (f.category ? 1 : 0) +
    f.sizes.length +
    f.brands.length +
    f.conditions.length +
    (f.minPriceCents != null ? 1 : 0) +
    (f.maxPriceCents != null ? 1 : 0) +
    (f.hideSold ? 1 : 0)
  );
}
