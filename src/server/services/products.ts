import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { PAGE_SIZE, type CatalogFilters } from "@/lib/catalog-params";
import { getDb } from "@/server/db/client";
import { categories, productImages, products } from "@/server/db/schema";
import { getStorage } from "@/server/storage";
import type { CatalogFacets, ProductListResult, PublicImage, PublicProduct } from "./types";

/** The single rule for what the public can see: available or sold, in an active category. */
const PUBLIC_STATUSES = ["available", "sold"] as const;
const isPublic = and(inArray(products.status, PUBLIC_STATUSES), eq(categories.isActive, true));

const publicColumns = {
  id: products.id,
  code: products.code,
  slug: products.slug,
  name: products.name,
  description: products.description,
  brand: products.brand,
  size: products.size,
  color: products.color,
  fabric: products.fabric,
  pieces: products.pieces,
  stitching: products.stitching,
  occasion: products.occasion,
  imperfections: products.imperfections,
  condition: products.condition,
  priceCents: products.priceCents,
  status: products.status,
  isFeatured: products.isFeatured,
  publishedAt: products.publishedAt,
  categoryName: categories.name,
  categorySlug: categories.slug,
};

type Row = {
  id: string;
  code: string;
  slug: string;
  name: string;
  description: string;
  brand: string | null;
  size: string | null;
  color: string | null;
  fabric: string | null;
  pieces: number | null;
  stitching: PublicProduct["stitching"];
  occasion: PublicProduct["occasion"];
  imperfections: string | null;
  condition: PublicProduct["condition"];
  priceCents: number;
  status: "draft" | "available" | "sold" | "archived";
  isFeatured: boolean;
  publishedAt: Date | null;
  categoryName: string;
  categorySlug: string;
};

function baseQuery() {
  return getDb()
    .select(publicColumns)
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id));
}

async function withImages(rows: Row[]): Promise<PublicProduct[]> {
  if (rows.length === 0) return [];
  const storage = getStorage();
  const images = await getDb()
    .select()
    .from(productImages)
    .where(
      inArray(
        productImages.productId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt));

  const byProduct = new Map<string, PublicImage[]>();
  for (const img of images) {
    const list = byProduct.get(img.productId) ?? [];
    list.push({
      url: storage.publicUrl(img.storageKey),
      alt: img.altText ?? "",
      width: img.width,
      height: img.height,
    });
    byProduct.set(img.productId, list);
  }

  return rows.map((r) => ({
    code: r.code,
    slug: r.slug,
    name: r.name,
    description: r.description,
    category: { name: r.categoryName, slug: r.categorySlug },
    brand: r.brand,
    size: r.size,
    color: r.color,
    fabric: r.fabric,
    pieces: r.pieces,
    stitching: r.stitching,
    occasion: r.occasion,
    imperfections: r.imperfections?.trim() || null,
    condition: r.condition,
    priceCents: r.priceCents,
    // Safe: every query in this file filters on PUBLIC_STATUSES.
    status: r.status as "available" | "sold",
    isFeatured: r.isFeatured,
    publishedAt: r.publishedAt,
    images: (byProduct.get(r.id) ?? []).map((img) => ({ ...img, alt: img.alt || r.name })),
  }));
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function filterConditions(f: Partial<CatalogFilters>): SQL | undefined {
  const where: (SQL | undefined)[] = [isPublic];

  const q = f.q?.trim();
  if (q) {
    const like = `%${escapeLike(q)}%`;
    where.push(
      or(
        sql`${products.searchVector} @@ websearch_to_tsquery('english', ${q})`,
        ilike(products.name, like),
        ilike(products.brand, like),
        ilike(products.fabric, like),
        ilike(products.code, like),
        ilike(categories.name, like),
      ),
    );
  }
  if (f.category) where.push(eq(categories.slug, f.category));
  if (f.sizes?.length) where.push(inArray(products.size, f.sizes));
  if (f.brands?.length) where.push(inArray(products.brand, f.brands));
  if (f.conditions?.length) where.push(inArray(products.condition, f.conditions));
  if (f.fabrics?.length) where.push(inArray(products.fabric, f.fabrics));
  if (f.occasions?.length) where.push(inArray(products.occasion, f.occasions));
  if (f.stitching?.length) where.push(inArray(products.stitching, f.stitching));
  if (f.pieces?.length) where.push(inArray(products.pieces, f.pieces));
  if (f.minPriceCents != null) where.push(gte(products.priceCents, f.minPriceCents));
  if (f.maxPriceCents != null) where.push(lte(products.priceCents, f.maxPriceCents));
  if (f.hideSold) where.push(eq(products.status, "available"));

  return and(...where);
}

/** Catalog listing with search, filters, sorting and paging. Available items always come before sold ones. */
export async function listProducts(
  filters: Partial<CatalogFilters> = {},
  pageSize: number = PAGE_SIZE,
): Promise<ProductListResult> {
  const where = filterConditions(filters);

  const [{ total }] = await getDb()
    .select({ total: sql<number>`count(*)::int` })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(where);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);

  const availableFirst = sql`case when ${products.status} = 'available' then 0 else 1 end`;
  const order =
    filters.sort === "price_asc"
      ? asc(products.priceCents)
      : filters.sort === "price_desc"
        ? desc(products.priceCents)
        : sql`${products.publishedAt} desc nulls last`;

  const rows = await baseQuery()
    .where(where)
    .orderBy(availableFirst, order, asc(products.code))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { items: await withImages(rows), total, page, pageCount };
}

export async function getProductBySlug(slug: string): Promise<PublicProduct | null> {
  if (!/^[a-z0-9-]{1,200}$/.test(slug)) return null;
  const rows = await baseQuery()
    .where(and(isPublic, eq(products.slug, slug)))
    .limit(1);
  return (await withImages(rows))[0] ?? null;
}

/** Featured items for the homepage. Only items that can actually be bought. */
export async function getFeaturedProducts(limit = 4): Promise<PublicProduct[]> {
  const rows = await baseQuery()
    .where(and(isPublic, eq(products.status, "available"), eq(products.isFeatured, true)))
    .orderBy(sql`${products.publishedAt} desc nulls last`, asc(products.code))
    .limit(limit);
  return withImages(rows);
}

export async function getRecentProducts(limit = 8): Promise<PublicProduct[]> {
  const rows = await baseQuery()
    .where(and(isPublic, eq(products.status, "available")))
    .orderBy(sql`${products.publishedAt} desc nulls last`, asc(products.code))
    .limit(limit);
  return withImages(rows);
}

/** Other available items from the same category. */
export async function getRelatedProducts(product: PublicProduct, limit = 4): Promise<PublicProduct[]> {
  const rows = await baseQuery()
    .where(
      and(
        isPublic,
        eq(products.status, "available"),
        eq(categories.slug, product.category.slug),
        ne(products.code, product.code),
      ),
    )
    .orderBy(sql`${products.publishedAt} desc nulls last`, asc(products.code))
    .limit(limit);
  return withImages(rows);
}

/** The sizes, brands and price range that exist among public products, for building filter controls. */
export async function getCatalogFacets(): Promise<CatalogFacets> {
  const db = getDb();
  const join = (col: typeof products.size | typeof products.brand | typeof products.fabric) =>
    db
      .selectDistinct({ value: col })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(and(isPublic, isNotNull(col), ne(col, "")));

  const [sizes, brands, fabrics, pieces, [range]] = await Promise.all([
    join(products.size),
    join(products.brand),
    join(products.fabric),
    db
      .selectDistinct({ value: products.pieces })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(and(isPublic, isNotNull(products.pieces))),
    db
      .select({
        min: sql<number | null>`min(${products.priceCents})::int`,
        max: sql<number | null>`max(${products.priceCents})::int`,
      })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(isPublic),
  ]);

  return {
    sizes: sortSizes(sizes.map((s) => s.value!)),
    brands: brands.map((b) => b.value!).sort((a, b) => a.localeCompare(b)),
    fabrics: fabrics.map((f) => f.value!).sort((a, b) => a.localeCompare(b)),
    pieces: pieces.map((p) => p.value!).sort((a, b) => a - b),
    minPriceCents: range?.min ?? null,
    maxPriceCents: range?.max ?? null,
  };
}

const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];

/** Letter sizes in their natural order, then numeric sizes, then anything else. */
export function sortSizes(sizes: string[]): string[] {
  const rank = (s: string): [number, number, string] => {
    const letter = SIZE_ORDER.indexOf(s.toUpperCase());
    if (letter >= 0) return [0, letter, s];
    const num = Number.parseFloat(s.replace(/^[^\d]*/, ""));
    if (Number.isFinite(num)) return [1, num, s];
    return [2, 0, s];
  };
  return [...sizes].sort((a, b) => {
    const [ga, na, sa] = rank(a);
    const [gb, nb, sb] = rank(b);
    return ga - gb || na - nb || sa.localeCompare(sb);
  });
}
