import { sql, type SQL } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const productCondition = pgEnum("product_condition", [
  "new_with_tags",
  "like_new",
  "good",
  "fair",
]);

export const productStatus = pgEnum("product_status", [
  "draft",
  "available",
  "sold",
  "archived",
]);

/** Feeds the human-readable product code (PLW-0001). Numbers are never reused. */
export const productCodeSeq = pgSequence("product_code_seq", { startWith: 1 });

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code")
      .notNull()
      .unique()
      .default(sql`'PLW-' || lpad(nextval('product_code_seq')::text, 4, '0')`),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    brand: text("brand"),
    size: text("size"),
    color: text("color"),
    condition: productCondition("condition").notNull(),
    priceCents: integer("price_cents").notNull(),
    status: productStatus("status").notNull().default("draft"),
    isFeatured: boolean("is_featured").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    soldAt: timestamp("sold_at", { withTimezone: true }),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      (): SQL =>
        sql`to_tsvector('english', coalesce(${products.name}, '') || ' ' || coalesce(${products.description}, '') || ' ' || coalesce(${products.brand}, '') || ' ' || coalesce(${products.color}, ''))`,
    ),
    ...timestamps,
  },
  (t) => [
    index("products_status_idx").on(t.status),
    index("products_category_idx").on(t.categoryId),
    index("products_published_idx").on(t.publishedAt),
    index("products_price_idx").on(t.priceCents),
    index("products_search_idx").using("gin", t.searchVector),
  ],
);

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    altText: text("alt_text"),
    sortOrder: integer("sort_order").notNull().default(0),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("product_images_product_idx").on(t.productId, t.sortOrder)],
);

export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
