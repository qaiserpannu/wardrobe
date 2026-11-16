import { describe, expect, it } from "vitest";
import { catalogHref, countActiveFilters, parseCatalogParams } from "@/lib/catalog-params";
import { formatPrice } from "@/lib/money";
import { parseSettings } from "@/lib/settings";
import { slugify } from "@/lib/slug";
import { classifySource, countablePath, isAutomatedVisitor, parsePlace } from "@/lib/visit-source";

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
      fabric: ["Cotton", "Raw silk"],
      occasion: ["bridal", "bogus"],
      stitching: "unstitched",
      pieces: ["3", "0", "x"],
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
    expect(f.fabrics).toEqual(["Cotton", "Raw silk"]);
    expect(f.occasions).toEqual(["bridal"]);
    expect(f.stitching).toEqual(["unstitched"]);
    expect(f.pieces).toEqual([3]);
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
    const original = parseCatalogParams({
      q: "silk",
      size: ["S", "M"],
      fabric: "Raw silk",
      occasion: "wedding",
      stitching: "stitched",
      pieces: ["2", "3"],
      max: "40",
      sort: "price_desc",
      page: "3",
    });
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

describe("share listing", () => {
  const base = {
    code: "PLW-0007",
    name: " Red Bridal Lehenga ",
    description: "Worn once.",
    priceCents: 32000,
    condition: "like_new" as const,
    url: "https://example.com/shop/red-bridal-lehenga-plw-0007",
    currency: "USD",
    locale: "en-US",
  };

  it("writes the listing only from what is saved", async () => {
    const { buildShareListing } = await import("@/lib/share-listing");
    const full = buildShareListing({ ...base, brand: "Maria B", size: "M", color: "Red", fabric: "Silk", pieces: 3, imperfections: "Small pull on the hem", location: "Tampa, FL" });
    expect(full.title).toBe("Red Bridal Lehenga - $320");
    expect(full.text.split("\n")[1]).toBe("Maria B · Size M · Like new · Red · Silk · 3 pieces");
    expect(full.text).toContain("Please note: Small pull on the hem");
    expect(full.text).toContain("Pickup in Tampa, FL.");
    expect(full.text).toContain("https://example.com/shop/red-bridal-lehenga-plw-0007");
    expect(full.text.trimEnd().endsWith("Item PLW-0007")).toBe(true);
  });

  it("leaves out details that are not filled in", async () => {
    const { buildShareListing } = await import("@/lib/share-listing");
    const bare = buildShareListing({ ...base, description: "", brand: "  ", size: null, pieces: null, location: "" });
    expect(bare.text.split("\n")[1]).toBe("Like new");
    expect(bare.text).not.toMatch(/Size|Please note|undefined|null/);
    expect(bare.text).toContain("Pickup in person.");
    for (const nothing of ["None noticed.", "none", "N/A", "No flaws"]) {
      expect(buildShareListing({ ...base, imperfections: nothing }).text).not.toContain("Please note");
    }
    expect(buildShareListing({ ...base, imperfections: "Noticeable fading" }).text).toContain("Please note: Noticeable fading");
  });
});

describe("shop description for search engines", () => {
  it("uses only what the owner has filled in", async () => {
    const { shopJsonLd } = await import("@/lib/shop-json-ld");
    const empty = shopJsonLd(parseSettings({}), "https://example.com", null);
    expect(empty).toMatchObject({ "@type": "Store", name: "Pre-Loved Wardrobe", url: "https://example.com/" });
    expect(empty).not.toHaveProperty("areaServed");
    expect(empty).not.toHaveProperty("image");
    expect(empty).not.toHaveProperty("sameAs");

    const filled = shopJsonLd(
      parseSettings({ contact: { location: "Tampa, FL", email: "a@example.com" }, social: { instagram: "https://instagram.com/x", facebook: "javascript:alert(1)" } }),
      "https://example.com",
      "/media/site/hero.webp",
    );
    expect(filled.areaServed).toBe("Tampa, FL");
    expect(filled.image).toBe("https://example.com/media/site/hero.webp");
    expect(filled.sameAs).toEqual(["https://instagram.com/x"]);
  });
});

describe("where a visit came from", () => {
  const own = "preloved-wardrobe.com";
  const from = (referrer: string | undefined, search = "") => classifySource(referrer, search, own)?.source ?? null;

  it("recognises the places the shop is shared", () => {
    expect(from("https://l.facebook.com/l.php?u=x")).toBe("facebook");
    expect(from("https://m.facebook.com/")).toBe("facebook");
    expect(from("https://l.instagram.com/")).toBe("instagram");
    expect(from("https://www.google.com/")).toBe("google");
    expect(from("https://www.google.co.uk/search?q=x")).toBe("google");
    expect(from("android-app://com.google.android.googlequicksearchbox/")).toBe("google");
    expect(from("https://www.bing.com/search?q=x")).toBe("search");
    expect(from("https://web.whatsapp.com/")).toBe("whatsapp");
    expect(from("https://nextdoor.com/post/1")).toBe("other");
    expect(from(undefined)).toBe("direct");
    expect(from("not a web address")).toBe("direct");
  });

  it("uses labels on the link when the app hides where it was tapped", () => {
    expect(from(undefined, "?fbclid=abc")).toBe("facebook");
    expect(from(undefined, "?igshid=abc")).toBe("instagram");
    expect(from(undefined, "?utm_source=WhatsApp")).toBe("whatsapp");
    expect(from(undefined, "?utm_source=something-else")).toBe("direct");
  });

  it("does not treat moving around our own site as a new visit", () => {
    expect(classifySource("https://preloved-wardrobe.com/shop", "", own)).toBeNull();
    expect(classifySource("https://www.preloved-wardrobe.com/", "", own)).toBeNull();
    expect(classifySource("http://localhost:3100/", "", "localhost:3100")).toBeNull();
    // A look-alike address is somebody else's site.
    expect(from("https://preloved-wardrobe.com.evil.example/")).toBe("other");
    expect(from("https://notgoogle.com.evil.example/")).toBe("other");
  });

  it("leaves out search engines and other automated visitors", () => {
    expect(isAutomatedVisitor("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
    expect(isAutomatedVisitor("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)")).toBe(true);
    expect(isAutomatedVisitor("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0.0.0 Safari/537.36")).toBe(true);
    expect(isAutomatedVisitor("curl/8.5.0")).toBe(true);
    expect(isAutomatedVisitor("")).toBe(true);
    expect(isAutomatedVisitor(null)).toBe(true);
    expect(isAutomatedVisitor("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1")).toBe(false);
    // Opened inside the Instagram app: a real person.
    expect(isAutomatedVisitor("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0")).toBe(false);
  });

  it("counts only the shop's real pages", () => {
    expect(countablePath("/")).toEqual({ path: "/", slug: null });
    expect(countablePath("/shop/")).toEqual({ path: "/shop", slug: null });
    expect(countablePath("/shop/red-lehenga-2")).toEqual({ path: "/shop/red-lehenga-2", slug: "red-lehenga-2" });
    expect(countablePath("/admin")).toBeNull();
    expect(countablePath("/shop/../admin")).toBeNull();
    expect(countablePath("/shop/a/b")).toBeNull();
  });

  it("reads the visitor's rough location, and shrugs at anything unexpected", () => {
    const geo = { city: "Tampa", country: { code: "US", name: "United States" }, subdivision: { code: "FL", name: "Florida" } };
    const expected = { city: "Tampa", region: "Florida", country: "United States" };
    expect(parsePlace(JSON.stringify(geo))).toEqual(expected);
    expect(parsePlace(Buffer.from(JSON.stringify(geo)).toString("base64"))).toEqual(expected);
    expect(parsePlace(null)).toEqual({ city: null, region: null, country: null });
    expect(parsePlace("garbage", "US")).toEqual({ city: null, region: null, country: "US" });
    expect(parsePlace(JSON.stringify({ city: "<script>alert(1)</script>" })).city).toBe("scriptalert(1)script");
  });
});
