import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { parseCatalogParams } from "@/lib/catalog-params";
import { closeDb, getDb } from "@/server/db/client";
import { categories, products } from "@/server/db/schema";
import { listCategories } from "@/server/services/categories";
import {
  getCatalogFacets,
  getFeaturedProducts,
  getProductBySlug,
  getRecentProducts,
  getRelatedProducts,
  listProducts,
  sortSizes,
} from "@/server/services/products";
import { getSettings } from "@/server/services/settings";

/** Runs against the test database, which holds the sample inventory (28 products). */
const all = (params: Record<string, string | string[]> = {}) => listProducts(parseCatalogParams(params), 100);

afterAll(closeDb);

describe("public visibility", () => {
  it("lists only available and sold products - never drafts or archived", async () => {
    const { items, total } = await all();
    expect(total).toBe(25); // 28 seeded minus 2 drafts and 1 archived
    expect(new Set(items.map((p) => p.status))).toEqual(new Set(["available", "sold"]));
    const names = items.map((p) => p.name);
    expect(names).not.toContain("Olive Cargo Pants"); // draft
    expect(names).not.toContain("Burgundy Knit Dress"); // draft
    expect(names).not.toContain("Suede Biker Jacket"); // archived
  });

  it("does not return a draft or archived product by its address", async () => {
    expect(await getProductBySlug("olive-cargo-pants-plw-0014")).toBeNull();
    expect(await getProductBySlug("suede-biker-jacket-plw-0021")).toBeNull();
    expect(await getProductBySlug("does-not-exist")).toBeNull();
    expect(await getProductBySlug("'; drop table products; --")).toBeNull();
  });

  it("cannot find drafts through search", async () => {
    expect((await all({ q: "cargo" })).total).toBe(0);
    expect((await all({ q: "PLW-0014" })).total).toBe(0);
  });

  it("hides products whose category is switched off", async () => {
    const db = getDb();
    await db.update(categories).set({ isActive: false }).where(eq(categories.slug, "shoes"));
    try {
      expect((await all({ q: "sneakers" })).total).toBe(0);
      expect((await listCategories()).map((c) => c.slug)).not.toContain("shoes");
    } finally {
      await db.update(categories).set({ isActive: true }).where(eq(categories.slug, "shoes"));
    }
  });
});

describe("availability", () => {
  it("lists available items before sold ones", async () => {
    const { items } = await all();
    const firstSold = items.findIndex((p) => p.status === "sold");
    expect(firstSold).toBe(22);
    expect(items.slice(firstSold).every((p) => p.status === "sold")).toBe(true);
  });

  it("can hide sold items", async () => {
    const { items, total } = await all({ hideSold: "1" });
    expect(total).toBe(22);
    expect(items.every((p) => p.status === "available")).toBe(true);
  });

  it("featured, recent and related lists contain only available items", async () => {
    const featured = await getFeaturedProducts(10);
    const recent = await getRecentProducts(50);
    expect(featured.length).toBe(6);
    expect(featured.every((p) => p.status === "available" && p.isFeatured)).toBe(true);
    expect(recent.length).toBe(22);
    expect(recent.every((p) => p.status === "available")).toBe(true);
    expect(recent[0].name).toBe("Little Black Dress"); // newest

    const sold = (await getProductBySlug("linen-shirt-dress-plw-0004"))!;
    const related = await getRelatedProducts(sold, 10);
    expect(related.length).toBe(4);
    expect(related.every((p) => p.status === "available" && p.category.slug === "dresses")).toBe(true);
  });

  it("reflects a status change immediately", async () => {
    const db = getDb();
    const slug = "canvas-shopper-plw-0025";
    expect((await getProductBySlug(slug))!.status).toBe("available");
    await db.update(products).set({ status: "sold" }).where(eq(products.slug, slug));
    try {
      expect((await getProductBySlug(slug))!.status).toBe("sold");
      expect((await getRecentProducts(50)).map((p) => p.slug)).not.toContain(slug);
    } finally {
      await db.update(products).set({ status: "available" }).where(eq(products.slug, slug));
    }
  });
});

describe("search", () => {
  it("finds by name keyword, including plural forms and partial words", async () => {
    expect((await all({ q: "dress" })).total).toBe(5);
    expect((await all({ q: "dresses" })).total).toBe(5);
    expect((await all({ q: "sneak" })).items.map((p) => p.name)).toEqual(["White Leather Sneakers"]);
  });

  it("finds by brand, colour, description and product ID", async () => {
    expect((await all({ q: "zara" })).total).toBe(4);
    expect((await all({ q: "terracotta" })).items.map((p) => p.code)).toEqual(["PLW-0027"]);
    expect((await all({ q: "utility pockets" })).total).toBe(0); // only in a draft
    expect((await all({ q: "tags still attached" })).items.map((p) => p.code)).toEqual(["PLW-0003"]);
    expect((await all({ q: "plw-0001" })).items.map((p) => p.name)).toEqual(["Black Midi Wrap Dress"]);
  });

  it("returns nothing for unknown terms and treats special characters as plain text", async () => {
    expect((await all({ q: "tuxedo" })).total).toBe(0);
    expect((await all({ q: "%" })).total).toBe(0);
    expect((await all({ q: "100%_" })).total).toBe(0);
    expect((await all({ q: "' OR 1=1 --" })).total).toBe(0);
  });
});

describe("filters", () => {
  it("filters by category", async () => {
    const { items, total } = await all({ category: "jeans" });
    expect(total).toBe(3);
    expect(items.every((p) => p.category.slug === "jeans")).toBe(true);
  });

  it("filters by one or several sizes", async () => {
    expect((await all({ size: "M" })).items.every((p) => p.size === "M")).toBe(true);
    const multi = await all({ size: ["S", "30"] });
    expect(multi.total).toBeGreaterThan(0);
    expect(multi.items.every((p) => p.size === "S" || p.size === "30")).toBe(true);
  });

  it("filters by brand", async () => {
    const { items, total } = await all({ brand: "Levi's" });
    expect(total).toBe(4);
    expect(items.every((p) => p.brand === "Levi's")).toBe(true);
  });

  it("filters by condition", async () => {
    const { items, total } = await all({ condition: "new_with_tags" });
    expect(total).toBe(2);
    expect(items.every((p) => p.condition === "new_with_tags")).toBe(true);
  });

  it("filters by price range, inclusive at both ends", async () => {
    const { items } = await all({ min: "20", max: "30" });
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((p) => p.priceCents >= 2000 && p.priceCents <= 3000)).toBe(true);
    expect(items.some((p) => p.priceCents === 2000)).toBe(true);
    expect(items.some((p) => p.priceCents === 3000)).toBe(true);
  });

  it("combines filters: a black dress under $30", async () => {
    const { items } = await all({ q: "black", category: "dresses", max: "30", hideSold: "1" });
    expect(items.map((p) => p.name).sort()).toEqual(["Black Midi Wrap Dress", "Little Black Dress"]);
  });
});

describe("sorting and paging", () => {
  it("sorts by newest first by default", async () => {
    const { items } = await all({ hideSold: "1" });
    const times = items.map((p) => p.publishedAt!.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it("sorts by price in both directions", async () => {
    const asc = (await all({ sort: "price_asc", hideSold: "1" })).items.map((p) => p.priceCents);
    const desc = (await all({ sort: "price_desc", hideSold: "1" })).items.map((p) => p.priceCents);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
  });

  it("pages without repeating or skipping items", async () => {
    const p1 = await listProducts(parseCatalogParams({}), 12);
    const p2 = await listProducts(parseCatalogParams({ page: "2" }), 12);
    const p3 = await listProducts(parseCatalogParams({ page: "3" }), 12);
    expect([p1.pageCount, p1.items.length, p2.items.length, p3.items.length]).toEqual([3, 12, 12, 1]);
    const codes = [...p1.items, ...p2.items, ...p3.items].map((p) => p.code);
    expect(new Set(codes).size).toBe(25);
    const beyond = await listProducts(parseCatalogParams({ page: "99" }), 12);
    expect(beyond.page).toBe(3);
  });
});

describe("product details and supporting data", () => {
  it("returns full details with ordered photos and a product ID", async () => {
    const p = (await getProductBySlug("black-midi-wrap-dress-plw-0001"))!;
    expect(p).toMatchObject({
      code: "PLW-0001",
      name: "Black Midi Wrap Dress",
      brand: "Zara",
      size: "M",
      color: "Black",
      condition: "like_new",
      priceCents: 2800,
      status: "available",
      category: { name: "Dresses", slug: "dresses" },
    });
    expect(p.images.map((i) => i.url)).toEqual([
      "/media/seed/plw-0001-1.webp",
      "/media/seed/plw-0001-2.webp",
      "/media/seed/plw-0001-3.webp",
    ]);
    expect(p).not.toHaveProperty("id");
  });

  it("keeps missing information as missing rather than inventing it", async () => {
    const p = (await getProductBySlug("canvas-shopper-plw-0025"))!;
    expect([p.brand, p.size, p.color]).toEqual([null, null, null]);
  });

  it("gives every product a unique ID", async () => {
    const { items } = await all();
    expect(items.every((p) => /^PLW-\d{4}$/.test(p.code))).toBe(true);
    expect(new Set(items.map((p) => p.code)).size).toBe(items.length);
  });

  it("builds filter options from public products only", async () => {
    const facets = await getCatalogFacets();
    expect(facets.brands).not.toContain("AllSaints"); // only on an archived item
    expect(facets.brands).toContain("Zara");
    expect(facets.sizes.slice(0, 3)).toEqual(["S", "M", "L"]);
    expect(facets.minPriceCents).toBe(800);
    expect(facets.maxPriceCents).toBe(7800); // the $95 jacket is archived
  });

  it("sorts sizes naturally", () => {
    expect(sortSizes(["L", "32", "S", "XL", "28", "M", "One size"])).toEqual(["S", "M", "L", "XL", "28", "32", "One size"]);
  });

  it("lists categories with available counts", async () => {
    const cats = await listCategories();
    expect(cats.map((c) => c.name)).toEqual(["Dresses", "Shirts", "Tops", "Pants", "Jeans", "Jackets", "Shoes", "Accessories"]);
    expect(cats.find((c) => c.slug === "dresses")!.availableCount).toBe(4);
    expect(cats.find((c) => c.slug === "pants")!.availableCount).toBe(2);
  });

  it("loads settings with defaults", async () => {
    const s = await getSettings();
    expect(s.branding.siteName).toBe("Pre-Loved Wardrobe");
    expect(s.whatsapp.number).toBe("15555550100");
    expect(s.homepage.heroImageKey).toBe("seed/hero.webp");
  });
});
