/**
 * Fills the database with sample data for development and tests.
 * Wipes existing products, categories and settings first.
 *
 *   npm run db:seed
 */
import { sql } from "drizzle-orm";
import { normalizeWhatsAppNumber } from "@/integrations/whatsapp";
import { slugify } from "@/lib/slug";
import { closeDb, getDb } from "../client";
import { runMigrations } from "../migrate";
import { categories, productImages, products, siteSettings } from "../schema";
import { localStorageDriver } from "../../storage/local";
import { renderHeroImage, renderProductImage } from "./artwork";
import { seedCategories, seedProducts } from "./data";

export async function seed() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "1") {
    throw new Error("Refusing to seed in production (it deletes existing data).");
  }
  const db = getDb();
  await runMigrations();

  await db.execute(sql`truncate table product_images, products, categories, site_settings restart identity cascade`);
  await db.execute(sql`alter sequence product_code_seq restart with 1`);

  const insertedCategories = await db
    .insert(categories)
    .values(seedCategories.map((name, i) => ({ name, slug: slugify(name), sortOrder: i })))
    .returning();
  const categoryId = new Map(insertedCategories.map((c) => [c.name, c.id]));

  // Spread publish dates so "newest arrivals" has a stable, meaningful order.
  const start = Date.now() - seedProducts.length * 36 * 60 * 60 * 1000;

  for (const [i, p] of seedProducts.entries()) {
    const published = p.status === "draft" ? null : new Date(start + i * 36 * 60 * 60 * 1000);
    const [row] = await db
      .insert(products)
      .values({
        slug: "pending",
        name: p.name,
        description: p.description,
        categoryId: categoryId.get(p.category)!,
        brand: p.brand,
        size: p.size,
        color: p.color,
        condition: p.condition,
        priceCents: p.price * 100,
        status: p.status,
        isFeatured: p.featured ?? false,
        publishedAt: published,
        soldAt: p.status === "sold" ? new Date() : null,
      })
      .returning({ id: products.id, code: products.code });

    const slug = `${slugify(p.name)}-${row.code.toLowerCase()}`;
    await db.update(products).set({ slug }).where(sql`${products.id} = ${row.id}`);

    for (let v = 0; v < (p.images ?? 2); v++) {
      const img = await renderProductImage(p.art, p.hex, v);
      const key = `seed/${row.code.toLowerCase()}-${v + 1}.webp`;
      await localStorageDriver.put(key, img.data, "image/webp");
      await db.insert(productImages).values({
        productId: row.id,
        storageKey: key,
        altText: v === 0 ? p.name : `${p.name} - detail ${v}`,
        sortOrder: v,
        width: img.width,
        height: img.height,
      });
    }
  }

  const hero = await renderHeroImage();
  await localStorageDriver.put("seed/hero.webp", hero.data, "image/webp");

  await db.insert(siteSettings).values([
    { key: "homepage", value: { heroImageKey: "seed/hero.webp" } },
    { key: "whatsapp", value: { number: normalizeWhatsAppNumber(process.env.SEED_WHATSAPP_NUMBER ?? "") } },
    { key: "contact", value: { email: "hello@example.com", location: "" } },
    { key: "social", value: { instagram: "https://instagram.com/", facebook: "https://facebook.com/" } },
  ]);

  return { products: seedProducts.length, categories: seedCategories.length };
}

if (process.argv[1]?.endsWith("index.ts")) {
  seed()
    .then((r) => console.log(`Seeded ${r.products} products in ${r.categories} categories.`))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(closeDb);
}
