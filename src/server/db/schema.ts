import { sql, type SQL } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  smallint,
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
  "pending",
  "sold",
  "archived",
]);

export const productStitching = pgEnum("product_stitching", ["stitched", "unstitched"]);

export const productOccasion = pgEnum("product_occasion", [
  "casual",
  "formal",
  "party",
  "festive",
  "wedding",
  "bridal",
]);

/** Feeds the human-readable product code (PLW-0001). Numbers are never reused. */
export const productCodeSeq = pgSequence("product_code_seq", { startWith: 1 });

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  /** Set on a category that sits inside a group (Lehengas inside Women). Groups themselves have no parent. */
  parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, { onDelete: "restrict" }),
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
    fabric: text("fabric"),
    /** How many pieces the outfit has (a 3-piece suit is 3). */
    pieces: smallint("pieces"),
    stitching: productStitching("stitching"),
    occasion: productOccasion("occasion"),
    /** Honest notes on flaws: marks, loose threads, alterations. */
    imperfections: text("imperfections"),
    condition: productCondition("condition").notNull(),
    priceCents: integer("price_cents").notNull(),
    status: productStatus("status").notNull().default("draft"),
    isFeatured: boolean("is_featured").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    soldAt: timestamp("sold_at", { withTimezone: true }),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      (): SQL =>
        sql`to_tsvector('english', coalesce(${products.name}, '') || ' ' || coalesce(${products.description}, '') || ' ' || coalesce(${products.brand}, '') || ' ' || coalesce(${products.color}, '') || ' ' || coalesce(${products.fabric}, ''))`,
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

/* ------------------------------------------------------------------ */
/* AI sales agent: conversations, leads, escalations (Milestone 4)     */
/* ------------------------------------------------------------------ */

export const channel = pgEnum("channel", ["web", "whatsapp"]);
export const conversationState = pgEnum("conversation_state", ["agent", "waiting_for_owner", "owner", "closed"]);
export const messageSender = pgEnum("message_sender", ["customer", "agent", "owner", "system"]);
export const leadStage = pgEnum("lead_stage", ["inquiry", "purchase_request", "reservation_request", "completed"]);
export const escalationReason = pgEnum("escalation_reason", ["cannot_answer", "human_requested", "purchase_request"]);
export const knowledgeKind = pgEnum("knowledge_kind", ["faq", "policy"]);

/** One person on one channel: an anonymous browser ID on the website, a phone number on WhatsApp. */
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channel: channel("channel").notNull(),
    channelIdentity: text("channel_identity").notNull(),
    name: text("name"),
    contact: text("contact"),
    ...timestamps,
  },
  (t) => [index("customers_identity_idx").on(t.channel, t.channelIdentity)],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    channel: channel("channel").notNull(),
    state: conversationState("state").notNull().default("agent"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [index("conversations_customer_idx").on(t.customerId, t.lastMessageAt)],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    sender: messageSender("sender").notNull(),
    body: text("body").notNull(),
    /** Product codes shown with this message. Cards are always re-read from inventory when displayed. */
    productCodes: jsonb("product_codes").$type<string[]>().notNull().default([]),
    /** The channel's own message ID, for ignoring duplicates (WhatsApp, Milestone 6). */
    channelMessageId: text("channel_message_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    stage: leadStage("stage").notNull(),
    summary: text("summary").notNull(),
    customerRequest: text("customer_request").notNull().default(""),
    ...timestamps,
  },
  (t) => [index("leads_conversation_idx").on(t.conversationId)],
);

export const escalations = pgTable(
  "escalations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    reason: escalationReason("reason").notNull(),
    question: text("question").notNull(),
    ownerAnswer: text("owner_answer"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("escalations_conversation_idx").on(t.conversationId)],
);

/** What the owner was told, by which route, and whether it went out. Also prevents duplicates. */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    kind: escalationReason("kind").notNull(),
    /** Same key = same event; a second one is not sent. */
    dedupeKey: text("dedupe_key").notNull().unique(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    route: text("route").notNull(),
    delivered: boolean("delivered").notNull().default(false),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_conversation_idx").on(t.conversationId)],
);

/** Approved business information the agent may quote. Nothing outside this (and the inventory) is ever stated. */
export const aiKnowledge = pgTable("ai_knowledge", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: knowledgeKind("kind").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

/* ------------------------------------------------------------------ */
/* Admin portal: login, sessions, audit log (Milestone 5)              */
/* ------------------------------------------------------------------ */

/** People who may sign in to /admin. Created only by the setup script; there is no sign-up page. */
export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Always stored in lower case. */
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  /** A salted scrypt hash. The password itself is never stored. */
  passwordHash: text("password_hash").notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  ...timestamps,
});

/** One signed-in browser. Only a fingerprint of the cookie value is stored. */
export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    /** Hard limit, however active the session is. */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admin_sessions_user_idx").on(t.userId)],
);

/** Failed sign-in attempts, kept briefly to slow down password guessing. */
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** "email:someone@example.com" or "ip:203.0.113.5". */
    subject: text("subject").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("login_attempts_subject_idx").on(t.subject, t.createdAt)],
);

/** Who changed what, and when. Rows are only ever added. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Null for automatic changes (for example a hold expiring) or a failed sign-in. */
    adminUserId: uuid("admin_user_id").references(() => adminUsers.id, { onDelete: "set null" }),
    /** Short machine name, e.g. "auth.login", "product.status". */
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    /** One plain-language line shown in the admin portal. */
    summary: text("summary").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_created_idx").on(t.createdAt), index("audit_log_entity_idx").on(t.entityType, t.entityId)],
);
