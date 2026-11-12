import { describe, expect, it } from "vitest";
import { catalogHref, countActiveFilters, parseCatalogParams } from "@/lib/catalog-params";
import { formatPrice } from "@/lib/money";
import { parseSettings } from "@/lib/settings";
import { slugify } from "@/lib/slug";

describe("catalog URL parameters", () => {
  it("uses safe defaults for an empty URL", () => {
    const f = parseCatalogParams({});
    expect(f).toMatchObject({ q: "", category: null, sizes: [], sort: "newest", page: 1, hideSold: false });
    expect(countActiveFilters(f)).toBe(0);
  });

  it("parses repeated values, prices and sorting", () => {
    const f = parseCatalogParams({
      q: "  dress ",
      category: "dresses",
      size: ["M", "L", "M"],
      brand: "Zara",
      condition: ["good", "bogus"],
      min: "10",
      max: "29.50",
      sort: "price_asc",
      page: "2",
      hideSold: "1",
    });
    expect(f.q).toBe("dress");
    expect(f.sizes).toEqual(["M", "L"]);
    expect(f.brands).toEqual(["Zara"]);
    expect(f.conditions).toEqual(["good"]);
    expect(f.minPriceCents).toBe(1000);
    expect(f.maxPriceCents).toBe(2950);
    expect(f.sort).toBe("price_asc");
    expect(f.page).toBe(2);
    expect(f.hideSold).toBe(true);
  });

  it("ignores hostile or nonsensical input", () => {
    const f = parseCatalogParams({
      category: "../../etc/passwd",
      min: "-5",
      max: "abc",
      sort: "drop table",
      page: "-3",
      q: "x".repeat(500),
    });
    expect(f.category).toBeNull();
    expect(f.minPriceCents).toBeNull();
    expect(f.maxPriceCents).toBeNull();
    expect(f.sort).toBe("newest");
    expect(f.page).toBe(1);
    expect(f.q.length).toBe(100);
  });

  it("swaps a reversed price range", () => {
    const f = parseCatalogParams({ min: "50", max: "20" });
    expect([f.minPriceCents, f.maxPriceCents]).toEqual([2000, 5000]);
  });

  it("round-trips through catalogHref", () => {
    const original = parseCatalogParams({ q: "silk", size: ["S", "M"], max: "40", sort: "price_desc", page: "3" });
    const href = catalogHref(original);
    const params = Object.fromEntries(
      [...new URL(href, "http://x").searchParams.keys()].map((k) => [
        k,
        new URL(href, "http://x").searchParams.getAll(k),
      ]),
    );
    expect(parseCatalogParams(params)).toEqual(original);
    expect(catalogHref({})).toBe("/shop");
  });
});

describe("helpers", () => {
  it("formats prices from cents", () => {
    expect(formatPrice(2800, "USD", "en-US")).toBe("$28");
    expect(formatPrice(2950, "USD", "en-US")).toBe("$29.50");
  });

  it("makes URL-safe slugs", () => {
    expect(slugify("Levi's 501® Jeans — Blue!")).toBe("levi-s-501-jeans-blue");
    expect(slugify("Crème Blouse")).toBe("creme-blouse");
  });

  it("fills in default settings and survives bad stored values", () => {
    const s = parseSettings({ branding: { siteName: "My Shop" }, shop: "garbage", whatsapp: { number: "abc" } });
    expect(s.branding.siteName).toBe("My Shop");
    expect(s.branding.tagline).toBeTruthy();
    expect(s.shop.currency).toBe("USD");
    expect(s.whatsapp.number).toBe("");
  });
});
