import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import path from "node:path";
import { and, eq, inArray, isNull } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseCatalogParams } from "@/lib/catalog-params";
import { parsePriceToCents, productInputSchema, type ProductInput } from "@/lib/product-form";
import { runAgentTool, type ToolContext } from "@/server/agent/tools";
import { closeDb, getDb } from "@/server/db/client";
import { auditLog, categories, productHolds, productImages, products, productStatusEvents } from "@/server/db/schema";
import { PhotoError, processProductPhoto } from "@/server/images/process";
import { type AdminUser, createAdmin } from "@/server/services/admin-auth";
import {
  addProductPhoto,
  AdminActionError,
  changeProductStatus,
  createProduct as createProductInDb,
  getAdminProduct,
  getProductPreview,
  listAdminProducts,
  listCategoryOptions,
  removeProductPhoto,
  reorderProductPhotos,
  updateHold,
  updateProduct,
} from "@/server/services/admin-products";
import { releaseExpiredHolds } from "@/server/services/hold-expiry";
import { getProductByCode, getProductBySlug, listProducts } from "@/server/services/products";
import { getSettings } from "@/server/services/settings";

let admin: AdminUser;
let categoryId: string;

/** Everything this file adds is removed afterwards, so other test files still see only the sample data. */
const createdIds: string[] = [];
const createProduct: typeof createProductInDb = async (...args) => {
  const created = await createProductInDb(...args);
  createdIds.push(created.id);
  return created;
};

const HOLD = { customerName: "Ayesha Secretname", customerContact: "813-555-0199", note: "Collecting Saturday. PRIVATE-NOTE", expiresAt: null };

async function photo(width = 900, height = 1200, format: "jpeg" | "png" | "webp" = "jpeg", color = "#7a1e2c") {
  return sharp({ create: { width, height, channels: 3, background: color } })[format]().toBuffer();
}

function input(overrides: Partial<ProductInput> = {}): ProductInput {
  return {
    name: `Test Kurta ${randomUUID().slice(0, 8)}`,
    description: "A test item.",
    categoryId,
    brand: "Test Brand",
    size: "M",
    color: "Blue",
    fabric: "Cotton",
    pieces: 1,
    stitching: "stitched",
    occasion: "casual",
    imperfections: null,
    condition: "good",
    priceCents: 2500,
    isFeatured: false,
    ...overrides,
  };
}

/** A new item with one photo, published. */
async function publishedItem() {
  const created = await createProduct(admin, input());
  await addProductPhoto(admin, created.id, await photo());
  await changeProductStatus(admin, created.id, "available");
  return created;
}

async function toolContext(): Promise<ToolContext> {
  return { channel: "web", conversationId: randomUUID(), customerId: randomUUID(), settings: await getSettings(), handoffRequested: false };
}

beforeAll(async () => {
  admin = await createAdmin({ email: `products-${randomUUID()}@test.invalid`, name: "Product Tester", password: "a-long-test-password-1" });
  categoryId = (await listCategoryOptions())[0].id;
});

afterAll(async () => {
  if (createdIds.length > 0) await getDb().delete(products).where(inArray(products.id, createdIds));
  await closeDb();
});

describe("the product form", () => {
  it("reads prices typed in the usual ways", () => {
    expect(parsePriceToCents("45")).toBe(4500);
    expect(parsePriceToCents("45.5")).toBe(4550);
    expect(parsePriceToCents("$1,200.00")).toBe(120000);
    for (const bad of ["", "0", "-5", "abc", "12.345", "1e5", "99999999"]) expect(parsePriceToCents(bad), bad).toBeNull();
  });

  it("turns empty boxes into 'not specified' and rejects bad values", () => {
    const base = { ...input(), brand: "  ", size: "", pieces: "", stitching: "", occasion: "" };
    const parsed = productInputSchema.parse(base);
    expect(parsed).toMatchObject({ brand: null, size: null, pieces: null, stitching: null, occasion: null });
    expect(productInputSchema.safeParse({ ...input(), name: "x" }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...input(), condition: "perfect" }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...input(), categoryId: "not-an-id" }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...input(), pieces: "40" }).success).toBe(false);
  });
});

describe("photo checks", () => {
  it("accepts JPEG, PNG and WebP, stores WebP, and shrinks large photos", async () => {
    for (const format of ["jpeg", "png", "webp"] as const) {
      const result = await processProductPhoto(await photo(800, 1000, format));
      expect((await sharp(result.data).metadata()).format).toBe("webp");
    }
    const big = await processProductPhoto(await photo(4000, 5000));
    expect(big.width).toBe(2000);
    expect(big.height).toBe(2500);
  });

  it("removes hidden details such as the phone's location", async () => {
    const withExif = await sharp({ create: { width: 800, height: 1000, channels: 3, background: "#336699" } })
      .withExif({ IFD0: { Copyright: "SECRET-OWNER-DETAIL" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "27/1 57/1 0/1" } })
      .jpeg()
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    const result = await processProductPhoto(withExif);
    expect((await sharp(result.data).metadata()).exif).toBeUndefined();
    expect(result.data.includes("SECRET-OWNER-DETAIL")).toBe(false);
  });

  it("turns a sideways phone photo upright", async () => {
    const sideways = await sharp({ create: { width: 1200, height: 900, channels: 3, background: "#336699" } })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    const result = await processProductPhoto(sideways);
    expect([result.width, result.height]).toEqual([900, 1200]);
  });

  it("rejects files that are not photos, whatever they are called", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900"><script>alert(1)</script></svg>');
    const gif = await sharp({ create: { width: 900, height: 900, channels: 3, background: "#fff" } }).gif().toBuffer();
    const fakeJpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("<?php echo 1; ?>".repeat(50))]);
    for (const bad of [Buffer.from("just some text"), Buffer.from("<html><script>alert(1)</script></html>"), svg, gif, fakeJpeg, Buffer.alloc(0)]) {
      await expect(processProductPhoto(bad)).rejects.toBeInstanceOf(PhotoError);
    }
  });

  it("rejects photos that are too small or too large", async () => {
    await expect(processProductPhoto(await photo(200, 300))).rejects.toThrow(/too small/);
    await expect(processProductPhoto(Buffer.alloc(15 * 1024 * 1024 + 1))).rejects.toThrow(/15 MB/);
  });
});

describe("adding and editing items", () => {
  it("starts every new item as a draft the public cannot see", async () => {
    const created = await createProduct(admin, input({ name: "Hidden Draft Lehenga" }));
    expect(created.code).toMatch(/^PLW-\d{4,}$/);
    const draft = await getAdminProduct(created.id);
    expect(draft).toMatchObject({ status: "draft", publishedAt: null });
    expect(draft!.slug).toBe(`hidden-draft-lehenga-${created.code.toLowerCase()}`);
    expect(await getProductByCode(created.code)).toBeNull();
    expect(await getProductBySlug(draft!.slug)).toBeNull();
    expect((await listProducts(parseCatalogParams({ q: "Hidden Draft Lehenga" }))).total).toBe(0);
  });

  it("will not publish without a photo", async () => {
    const created = await createProduct(admin, input());
    await expect(changeProductStatus(admin, created.id, "available")).rejects.toThrow(/photo/);
    expect((await getAdminProduct(created.id))!.status).toBe("draft");
  });

  it("publishes, and the item appears to the public and to the assistant straight away", async () => {
    const created = await publishedItem();
    const live = await getProductByCode(created.code);
    expect(live).toMatchObject({ status: "available", priceCents: 2500 });
    expect(live!.images).toHaveLength(1);
    expect(live!.images[0].url).toMatch(new RegExp(`^/media/products/${created.code.toLowerCase()}/[0-9a-f]{16}\\.webp$`));
    expect((await getAdminProduct(created.id))!.publishedAt).toBeInstanceOf(Date);
  });

  it("saves edits immediately, records what changed, and keeps the web address of a published item", async () => {
    const created = await publishedItem();
    const before = await getAdminProduct(created.id);
    await updateProduct(admin, created.id, { ...input(), name: "Renamed After Publishing", priceCents: 3100, imperfections: "Small mark on hem." });
    const after = await getProductByCode(created.code);
    expect(after).toMatchObject({ name: "Renamed After Publishing", priceCents: 3100, imperfections: "Small mark on hem.", slug: before!.slug });
    const [entry] = await getDb()
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, created.id), eq(auditLog.action, "product.update")));
    expect(entry.adminUserId).toBe(admin.id);
    expect(entry.details).toMatchObject({ priceCents: { from: 2500, to: 3100 } });
  });

  it("refuses a category that does not exist or is a group of other categories", async () => {
    const [group] = await getDb().select().from(categories).where(isNull(categories.parentId)).limit(1);
    await expect(createProduct(admin, input({ categoryId: group.id }))).rejects.toBeInstanceOf(AdminActionError);
    await expect(createProduct(admin, input({ categoryId: randomUUID() }))).rejects.toBeInstanceOf(AdminActionError);
  });

  it("finds items by name, product ID or brand, in any status", async () => {
    const created = await createProduct(admin, input({ name: "Findable Zebra Shawl", brand: "Quagga Looms" }));
    for (const search of ["zebra shawl", created.code.toLowerCase(), "quagga"]) {
      const result = await listAdminProducts({ search });
      expect(result.items.map((i) => i.id), search).toContain(created.id);
    }
    expect((await listAdminProducts({ search: "100%_match" })).total).toBe(0);
    expect((await listAdminProducts({ status: "archived" })).items.every((i) => i.status === "archived")).toBe(true);
  });
});

describe("photos", () => {
  it("keeps the order the owner chooses; the first photo is the cover", async () => {
    const created = await createProduct(admin, input());
    const a = await addProductPhoto(admin, created.id, await photo(900, 1200, "jpeg", "#aa0000"));
    const b = await addProductPhoto(admin, created.id, await photo(900, 1200, "jpeg", "#00aa00"));
    const c = await addProductPhoto(admin, created.id, await photo(900, 1200, "jpeg", "#0000aa"));
    await reorderProductPhotos(admin, created.id, [c.id, a.id, b.id]);
    expect((await getAdminProduct(created.id))!.images.map((i) => i.id)).toEqual([c.id, a.id, b.id]);
    expect((await listAdminProducts({ search: created.code })).items[0].cover?.id).toBe(c.id);

    await expect(reorderProductPhotos(admin, created.id, [c.id, a.id])).rejects.toBeInstanceOf(AdminActionError);
    await expect(reorderProductPhotos(admin, created.id, [c.id, a.id, randomUUID()])).rejects.toBeInstanceOf(AdminActionError);
  });

  it("removes the stored file with the photo, but never the last photo of an item on the website", async () => {
    const created = await publishedItem();
    const [first] = (await getAdminProduct(created.id))!.images;
    const file = path.resolve("storage/test", first.url.replace("/media/", ""));
    await access(file);
    await expect(removeProductPhoto(admin, created.id, first.id)).rejects.toThrow(/at least one photo/);

    await addProductPhoto(admin, created.id, await photo(900, 1200, "jpeg", "#123456"));
    await removeProductPhoto(admin, created.id, first.id);
    await expect(access(file)).rejects.toThrow();
    expect((await getAdminProduct(created.id))!.images).toHaveLength(1);
  });

  it("cannot remove a photo through a different item", async () => {
    const one = await publishedItem();
    const two = await createProduct(admin, input());
    const [image] = (await getAdminProduct(one.id))!.images;
    await expect(removeProductPhoto(admin, two.id, image.id)).rejects.toBeInstanceOf(AdminActionError);
  });

  it("allows at most twelve photos", async () => {
    const created = await createProduct(admin, input());
    await getDb()
      .insert(productImages)
      .values(Array.from({ length: 12 }, (_, i) => ({ productId: created.id, storageKey: `products/x/${i}.webp`, sortOrder: i, width: 10, height: 10 })));
    await expect(addProductPhoto(admin, created.id, await photo())).rejects.toThrow(/12 photos/);
  });
});

describe("status changes", () => {
  it("allows only the agreed moves", async () => {
    const created = await publishedItem();
    await expect(changeProductStatus(admin, created.id, "draft")).rejects.toBeInstanceOf(AdminActionError);
    await changeProductStatus(admin, created.id, "sold");
    expect((await getAdminProduct(created.id))!.soldAt).toBeInstanceOf(Date);
    await expect(changeProductStatus(admin, created.id, "pending", { hold: HOLD })).rejects.toBeInstanceOf(AdminActionError);
    await changeProductStatus(admin, created.id, "available"); // undo the sale
    expect((await getAdminProduct(created.id))!.soldAt).toBeNull();
    await changeProductStatus(admin, created.id, "archived");
    await expect(changeProductStatus(admin, created.id, "available")).rejects.toBeInstanceOf(AdminActionError);
    await changeProductStatus(admin, created.id, "draft");
    await expect(changeProductStatus(admin, randomUUID(), "available")).rejects.toBeInstanceOf(AdminActionError);
  });

  it("keeps every change in the item's history, with who made it", async () => {
    const created = await publishedItem();
    await changeProductStatus(admin, created.id, "sold");
    const history = (await getAdminProduct(created.id))!.history;
    expect(history.map((h) => `${h.fromStatus}>${h.toStatus}`).sort()).toEqual(["available>sold", "draft>available", "null>draft"]);
    expect(history.every((h) => h.adminName === "Product Tester")).toBe(true);
  });

  it("archiving hides an item from the public but deletes nothing", async () => {
    const created = await publishedItem();
    await changeProductStatus(admin, created.id, "archived");
    expect(await getProductByCode(created.code)).toBeNull();
    const kept = await getAdminProduct(created.id);
    expect(kept).toMatchObject({ status: "archived" });
    expect(kept!.images).toHaveLength(1);
    expect(kept!.history.length).toBeGreaterThanOrEqual(3);
  });

  it("the assistant sees a status change immediately", async () => {
    const created = await publishedItem();
    const ask = async () => JSON.stringify((await runAgentTool(await toolContext(), "get_product", { product_id: created.code })).content);
    expect(await ask()).toContain("available");
    await changeProductStatus(admin, created.id, "sold");
    expect(await ask()).toMatch(/sold/i);
  });
});

describe("holds", () => {
  it("needs a customer name, and ends after the shop's usual 72 hours by default", async () => {
    const created = await publishedItem();
    await expect(changeProductStatus(admin, created.id, "pending")).rejects.toThrow(/held for/);
    await changeProductStatus(admin, created.id, "pending", { hold: HOLD });
    const { hold } = (await getAdminProduct(created.id))!;
    expect(hold).toMatchObject({ customerName: "Ayesha Secretname", customerContact: "813-555-0199" });
    const hours = (hold!.expiresAt!.getTime() - hold!.heldAt.getTime()) / 3_600_000;
    expect(hours).toBeCloseTo(72, 1);
  });

  it("never shows hold details to the public, the assistant, the preview or the audit log", async () => {
    const created = await publishedItem();
    await changeProductStatus(admin, created.id, "pending", { hold: HOLD });
    const secrets = /Secretname|813-555-0199|PRIVATE-NOTE/;

    const publicProduct = await getProductByCode(created.code);
    expect(publicProduct!.status).toBe("pending");
    expect(JSON.stringify(publicProduct)).not.toMatch(secrets);
    expect(JSON.stringify(await listProducts(parseCatalogParams({}), 200))).not.toMatch(secrets);
    expect(JSON.stringify(await getProductPreview(created.id))).not.toMatch(secrets);

    const ctx = await toolContext();
    for (const [tool, args] of [
      ["get_product", { product_id: created.code }],
      ["search_products", { query: "Test Kurta" }],
    ] as const) {
      expect(JSON.stringify(await runAgentTool(ctx, tool, args))).not.toMatch(secrets);
    }

    const audit = await getDb().select().from(auditLog).where(eq(auditLog.entityId, created.id));
    expect(JSON.stringify(audit)).not.toMatch(secrets);
  });

  it("can be edited and extended", async () => {
    const created = await publishedItem();
    await changeProductStatus(admin, created.id, "pending", { hold: HOLD });
    const later = new Date(Date.now() + 7 * 24 * 3_600_000);
    await updateHold(admin, created.id, { ...HOLD, customerName: "Bilal", expiresAt: later });
    const { hold } = (await getAdminProduct(created.id))!;
    expect(hold).toMatchObject({ customerName: "Bilal" });
    expect(hold!.expiresAt!.getTime()).toBe(later.getTime());
    await updateHold(admin, created.id, { ...HOLD, expiresAt: null }); // keep the end time
    expect((await getAdminProduct(created.id))!.hold!.expiresAt!.getTime()).toBe(later.getTime());
    await expect(updateHold(admin, created.id, { ...HOLD, expiresAt: new Date(Date.now() - 1000) })).rejects.toThrow(/future/);
  });

  it("is closed, not deleted, when the item is sold or released", async () => {
    const sold = await publishedItem();
    await changeProductStatus(admin, sold.id, "pending", { hold: HOLD });
    await changeProductStatus(admin, sold.id, "sold");
    const released = await publishedItem();
    await changeProductStatus(admin, released.id, "pending", { hold: HOLD });
    await changeProductStatus(admin, released.id, "available");

    const [a] = await getDb().select().from(productHolds).where(eq(productHolds.productId, sold.id));
    const [b] = await getDb().select().from(productHolds).where(eq(productHolds.productId, released.id));
    expect(a).toMatchObject({ endReason: "sold", customerName: "Ayesha Secretname" });
    expect(b).toMatchObject({ endReason: "released" });
    expect((await getAdminProduct(sold.id))!.hold).toBeNull();
    await expect(updateHold(admin, released.id, HOLD)).rejects.toThrow(/no longer on hold/);
  });

  it("ends by itself when its time is up, and the item is available again", async () => {
    const expired = await publishedItem();
    const current = await publishedItem();
    await changeProductStatus(admin, expired.id, "pending", { hold: HOLD });
    await changeProductStatus(admin, current.id, "pending", { hold: HOLD });
    await getDb().update(productHolds).set({ expiresAt: new Date(Date.now() - 60_000) }).where(eq(productHolds.productId, expired.id));

    expect(await releaseExpiredHolds()).toEqual([expired.code]);
    expect((await getProductByCode(expired.code))!.status).toBe("available");
    expect((await getProductByCode(current.code))!.status).toBe("pending");

    const [hold] = await getDb().select().from(productHolds).where(eq(productHolds.productId, expired.id));
    expect(hold.endReason).toBe("expired");
    const events = await getDb().select().from(productStatusEvents).where(eq(productStatusEvents.productId, expired.id));
    expect(events.some((e) => e.fromStatus === "pending" && e.toStatus === "available" && e.adminUserId === null)).toBe(true);
    expect(await releaseExpiredHolds()).toEqual([]); // nothing left to do
  });

  it("an item already sold is not touched by an old hold", async () => {
    const created = await publishedItem();
    await changeProductStatus(admin, created.id, "pending", { hold: HOLD });
    await changeProductStatus(admin, created.id, "sold");
    await getDb().update(productHolds).set({ expiresAt: new Date(Date.now() - 60_000) }).where(eq(productHolds.productId, created.id));
    await releaseExpiredHolds();
    const [row] = await getDb().select({ status: products.status }).from(products).where(eq(products.id, created.id));
    expect(row.status).toBe("sold");
  });
});
