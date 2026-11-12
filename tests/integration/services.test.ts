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
    expect(names).not.toContain("Navy Mirror Work Lehenga"); // draft
    expect(names).not.toContain("Maroon Khussa Shoes"); // draft
    expect(names).not.toContain("Gold Tissue Anarkali Gown"); // archived
  });

  it("does not return a draft or archived product by its address", async () => {
    expect(await getProductBySlug("navy-mirror-work-lehenga-plw-0013")).toBeNull();
    expect(await getProductBySlug("gold-tissue-anarkali-gown-plw-0020")).toBeNull();
    expect(await getProductBySlug("does-not-exist")).toBeNull();
    expect(await getProductBySlug("'; drop table products; --")).toBeNull();
  });

  it("cannot find drafts through search", async () => {
    expect((await all({ q: "mirror" })).total).toBe(0);
    expect((await all({ q: "PLW-0013" })).total).toBe(0);
  });

  it("hides products whose category is switched off", async () => {
    const db = getDb();
    await db.update(categories).set({ isActive: false }).where(eq(categories.slug, "sarees"));
    try {
      expect((await all({ q: "banarasi" })).total).toBe(0);
      expect((await listCategories()).map((c) => c.slug)).not.toContain("sarees");
    } finally {
      await db.update(categories).set({ isActive: true }).where(eq(categories.slug, "sarees"));
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
    expect(recent[0].name).toBe("Black Chiffon Formal Suit"); // newest

    const sold = (await getProductBySlug("mustard-cotton-printed-suit-plw-0004"))!;
    const related = await getRelatedProducts(sold, 10);
    expect(related.length).toBe(4);
    expect(related.every((p) => p.status === "available" && p.category.slug === "shalwar-kameez")).toBe(true);
  });

  it("reflects a status change immediately", async () => {
    const db = getDb();
    const slug = "embroidered-potli-bag-plw-0024";
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
    expect((await all({ q: "kurta" })).total).toBe(6);
    expect((await all({ q: "kurtas" })).total).toBe(6);
    expect((await all({ q: "saree" })).total).toBe(3);
    expect((await all({ q: "jhum" })).items.map((p) => p.name)).toEqual(["Gold Kundan Jhumka Earrings"]);
  });

  it("finds by brand, colour, description and product ID", async () => {
    expect((await all({ q: "maria b" })).total).toBe(3);
    expect((await all({ q: "orange" })).items.map((p) => p.code)).toEqual(["PLW-0026"]);
    expect((await all({ q: "mirror work panels" })).total).toBe(0); // only in a draft
    expect((await all({ q: "tags still attached" })).items.map((p) => p.code)).toEqual(["PLW-0003"]);
    expect((await all({ q: "plw-0001" })).items.map((p) => p.name)).toEqual(["Teal Embroidered Lawn Suit"]);
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
    const { items, total } = await all({ category: "sarees" });
    expect(total).toBe(3);
    expect(items.every((p) => p.category.slug === "sarees")).toBe(true);
  });

  it("filters by one or several sizes", async () => {
    expect((await all({ size: "M" })).items.every((p) => p.size === "M")).toBe(true);
    const multi = await all({ size: ["S", "Free size"] });
    expect(multi.total).toBeGreaterThan(0);
    expect(multi.items.every((p) => p.size === "S" || p.size === "Free size")).toBe(true);
  });

  it("filters by brand", async () => {
    const { items, total } = await all({ brand: "Fabindia" });
    expect(total).toBe(3);
    expect(items.every((p) => p.brand === "Fabindia")).toBe(true);
  });

  it("filters by condition", async () => {
    const { items, total } = await all({ condition: "new_with_tags" });
    expect(total).toBe(2);
    expect(items.every((p) => p.condition === "new_with_tags")).toBe(true);
  });

  it("filters by price range, inclusive at both ends", async () => {
    const { items } = await all({ min: "16", max: "30" });
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((p) => p.priceCents >= 1600 && p.priceCents <= 3000)).toBe(true);
    expect(items.some((p) => p.priceCents === 1600)).toBe(true);
    expect(items.some((p) => p.priceCents === 3000)).toBe(true);
  });

  it("filters by fabric, occasion, stitching and number of pieces", async () => {
    const cotton = await all({ fabric: "Cotton" });
    expect(cotton.total).toBe(6);
    expect(cotton.items.every((p) => p.fabric === "Cotton")).toBe(true);

    expect((await all({ occasion: "bridal" })).items.map((p) => p.name)).toEqual(["Red Bridal Lehenga Choli"]);
    expect((await all({ occasion: "wedding" })).total).toBe(4);
    expect((await all({ occasion: "wedding", hideSold: "1" })).total).toBe(3);
    expect((await all({ occasion: ["bridal", "wedding"] })).total).toBe(5);

    const unstitched = await all({ stitching: "unstitched" });
    expect(unstitched.items.map((p) => p.code).sort()).toEqual(["PLW-0003", "PLW-0014"]);

    const three = await all({ pieces: "3" });
    expect(three.total).toBe(5);
    expect(three.items.every((p) => p.pieces === 3)).toBe(true);

    expect((await all({ occasion: "nonsense", pieces: "abc", stitching: "x" })).total).toBe(25); // ignored
  });

  it("finds products by fabric in keyword search", async () => {
    expect((await all({ q: "wool" })).items.map((p) => p.name)).toEqual(["Black Prince Coat"]);
    expect((await all({ q: "tissue silk" })).total).toBe(0); // archived item only
  });

  it("combines filters: something black under $70 that is still available", async () => {
    const { items } = await all({ q: "black", max: "70", hideSold: "1" });
    expect(items.map((p) => p.name).sort()).toEqual(["Black Chiffon Formal Suit", "Black Embroidered Kurti"]);
    const narrowed = await all({ q: "black", category: "kurtas", max: "70", hideSold: "1" });
    expect(narrowed.items.map((p) => p.name)).toEqual(["Black Embroidered Kurti"]);
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
    const p = (await getProductBySlug("teal-embroidered-lawn-suit-plw-0001"))!;
    expect(p).toMatchObject({
      code: "PLW-0001",
      name: "Teal Embroidered Lawn Suit",
      brand: "Khaadi",
      size: "M",
      color: "Teal",
      condition: "like_new",
      priceCents: 4500,
      status: "available",
      fabric: "Lawn",
      pieces: 3,
      stitching: "stitched",
      occasion: "casual",
      imperfections: "None noticed.",
      category: { name: "Shalwar Kameez", slug: "shalwar-kameez" },
    });
    expect(p.images).toHaveLength(3);
    p.images.forEach((img, i) =>
      expect(img.url).toMatch(new RegExp(`^/media/seed/plw-0001-${i + 1}-[0-9a-f]{8}\\.webp$`)),
    );
    expect(p).not.toHaveProperty("id");
  });

  it("keeps missing information as missing rather than inventing it", async () => {
    const p = (await getProductBySlug("embroidered-potli-bag-plw-0024"))!;
    expect([p.brand, p.size, p.color]).toEqual([null, null, null]);
    expect([p.fabric, p.pieces, p.stitching, p.occasion, p.imperfections]).toEqual([null, null, null, null, null]);
  });

  it("gives every product a unique ID", async () => {
    const { items } = await all();
    expect(items.every((p) => /^PLW-\d{4}$/.test(p.code))).toBe(true);
    expect(new Set(items.map((p) => p.code)).size).toBe(items.length);
  });

  it("builds filter options from public products only", async () => {
    const facets = await getCatalogFacets();
    expect(facets.brands).not.toContain("Elan"); // only on an archived item
    expect(facets.brands).not.toContain("W"); // only on a draft
    expect(facets.brands).toContain("Khaadi");
    expect(facets.sizes).toEqual(["S", "M", "L", "Free size"]); // size 38 is only on a draft
    expect(facets.fabrics).toContain("Banarasi silk");
    expect(facets.fabrics).not.toContain("Tissue silk"); // archived item only
    expect(facets.fabrics).toEqual([...facets.fabrics].sort((a, b) => a.localeCompare(b)));
    expect(facets.pieces).toEqual([1, 2, 3]);
    expect(facets.minPriceCents).toBe(900);
    expect(facets.maxPriceCents).toBe(32000);
  });

  it("sorts sizes naturally", () => {
    expect(sortSizes(["L", "32", "S", "XL", "28", "M", "One size"])).toEqual(["S", "M", "L", "XL", "28", "32", "One size"]);
  });

  it("lists categories with available counts", async () => {
    const cats = await listCategories();
    expect(cats.map((c) => c.name)).toEqual(["Shalwar Kameez", "Kurtas", "Lehengas", "Sarees", "Anarkalis", "Menswear", "Dupattas", "Accessories"]);
    expect(cats.find((c) => c.slug === "shalwar-kameez")!.availableCount).toBe(4);
    expect(cats.find((c) => c.slug === "lehengas")!.availableCount).toBe(2);
  });

  it("loads settings with defaults", async () => {
    const s = await getSettings();
    expect(s.branding.siteName).toBe("Pre-Loved Wardrobe");
    expect(s.branding.byline).toBe("By Skyra");
    expect(s.whatsapp.number).toBe("15555550100");
    expect(s.homepage.heroImageKey).toMatch(/^seed\/hero-[0-9a-f]{8}\.webp$/);
  });
});
