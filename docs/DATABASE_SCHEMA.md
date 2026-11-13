# Database Schema

Tables marked **(built)** exist; the source of truth for them is
`src/server/db/schema.ts` with migrations in `src/server/db/migrations`. Other
tables are planned and are created in the milestone that first needs them.

Database: PostgreSQL. All tables have `created_at` and `updated_at` timestamps
unless noted.

## Relationships

```
categories (group) 1 ──── many categories 1 ──── many products 1 ──── many product_images
admin users 1 ──── many audit_log entries
site_settings   (standalone key/value)
ai_knowledge    (standalone FAQ / policy entries)
```

## categories — Milestone 2 (built)

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid, primary key | |
| name | text, unique | "Dresses" |
| slug | text, unique | "lehengas", used in URLs |
| parent_id | uuid → categories.id, nullable | The group this category sits in. Null for a group (Women, Men...). Two levels only |
| sort_order | integer | Display order |
| is_active | boolean | Hidden categories stay in the database |

Deleting a category that still has products is blocked; the admin must move or
archive the products first.

## products — Milestone 2 (built)

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid, primary key | Internal ID |
| code | text, unique | Human-readable product ID, e.g. `PLW-0042`. Generated from a sequence, never reused |
| slug | text, unique | URL part, e.g. `zara-black-midi-dress-plw-0042` |
| name | text | |
| description | text | |
| category_id | uuid → categories.id | |
| brand | text, nullable | Missing is allowed and shown as "not specified" |
| size | text, nullable | Free text ("M", "UK 10", "32W") — see TECHNICAL_DECISIONS D16 |
| color | text, nullable | |
| fabric | text, nullable | Free text ("Lawn", "Chiffon"); searchable; filter options built from values in use |
| pieces | smallint, nullable | Number of pieces in the outfit (3 = 3-piece) |
| stitching | enum, nullable | `stitched`, `unstitched` |
| occasion | enum, nullable | `casual`, `formal`, `party`, `festive`, `wedding`, `bridal` |
| imperfections | text, nullable | Seller's notes on flaws. Null means nothing recorded, not "no flaws" |
| condition | enum | `new_with_tags`, `like_new`, `good`, `fair` |
| price_cents | integer | Price in smallest currency unit |
| status | enum | `draft`, `available`, `pending` (on hold), `sold`, `archived` — D25 |
| is_featured | boolean | Shown in homepage "Featured" |
| published_at | timestamp, nullable | Set when first made available; drives "newest" sorting |
| sold_at | timestamp, nullable | |
| search_vector | tsvector, generated | Full-text search over name, description, brand, color, fabric |

Visibility rules, enforced in the services layer:

- `draft`, `archived`: never visible publicly or to the AI assistant.
- `available`: visible and can be inquired about.
- `pending`: visible with an ON HOLD badge, no purchase prompt, listed after
  available items. Who the hold is for is not stored on the product.
- `sold`: visible with a SOLD badge, no purchase prompt, listed last.
- A product in an inactive category is hidden regardless of status.

Indexes: `status`, `category_id`, `published_at`, `price_cents`, and a GIN index
on `search_vector`.

## product_images — Milestone 2 (built)

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid, primary key | |
| product_id | uuid → products.id | Deleted with the product |
| storage_key | text | Location in image storage (not a full URL) |
| alt_text | text, nullable | |
| sort_order | integer | 0 is the main photo |
| width, height | integer | For layout without page jumps |

## site_settings — Milestone 2 (built, read-only), Milestone 5 (edit)

| Column | Type | Notes |
| --- | --- | --- |
| key | text, primary key | Built: `branding`, `shop`, `contact`, `whatsapp`, `social`, `seo`, `homepage`, `chat_widget` (on/off, title, greeting, corner), `ai_assistant` (on/off, name, greeting, tone guidance, handoff message, notification email, daily message limit) |
| value | jsonb | Validated against a schema per key in code |
| updated_at | timestamp | |

The shape and defaults of each key are defined in `src/lib/settings.ts`; a
missing or invalid row falls back to defaults, so the site always renders.

Grouping settings as a few validated JSON documents means new settings do not
need database changes. Secrets (API keys) are never stored here — they stay in
environment variables.

## ai_knowledge — Milestone 4 (built)

Approved business information the assistant may quote.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid, primary key | |
| kind | enum | `faq`, `policy` |
| title | text | Question or policy name |
| content | text | Approved answer |
| is_active | boolean | |
| sort_order | integer | |

## admin_users — Milestone 5 (built)

Created only by the setup command (`npm run admin:create`); see D36.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid, primary key | |
| email | text, unique | Lower case |
| name | text | Shown in the portal and the audit log |
| password_hash | text | Salted scrypt hash; the password is never stored |
| last_login_at | timestamp | |
| created_at, updated_at | timestamp | |

## admin_sessions — Milestone 5 (built)

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid, primary key | |
| user_id | → admin_users | Deleted with the user |
| token_hash | text, unique | SHA-256 of the cookie value; the value itself is not stored |
| expires_at | timestamp | 30 days after sign-in |
| last_seen_at | timestamp | A session unused for 7 days is no longer accepted |
| created_at | timestamp | |

## login_attempts — Milestone 5 (built)

Failed sign-ins, kept for a day, used to lock out password guessing.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid, primary key | |
| subject | text | `email:…` or `ip:…` |
| created_at | timestamp | |

## audit_log — Milestone 5 (built)

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid, primary key | |
| admin_user_id | → admin_users, nullable | Null for automatic changes and unknown sign-in attempts |
| action | text | e.g. `auth.login`, `product.status`, `settings.update` |
| entity_type | text, nullable | `product`, `category`, `settings` |
| entity_id | text, nullable | |
| summary | text | One plain-language line shown in the portal |
| details | jsonb, nullable | Before/after values; never passwords or secrets |
| created_at | timestamp | No `updated_at`; entries are never edited |

## Planned for the expanded roadmap (not built)

Designed now so later milestones add tables rather than change existing ones.
Column lists are indicative and will be finalised in each milestone.

### product_status_events — Milestone 5 (built)

One row per status change. History is never deleted.

| Column | Notes |
| --- | --- |
| product_id | → products.id |
| from_status, to_status | `from_status` is null for "created" |
| admin_user_id | Null when the system did it (a hold expiring) |
| note | Optional |
| created_at | |

### product_holds — Milestone 5 (built, admin only)

| Column | Notes |
| --- | --- |
| product_id | → products.id; at most one active hold per product (unique index) |
| customer_name, customer_contact, note | Internal only |
| held_at, expires_at | Expiry defaults to the `holds.expiryHours` setting (72) after the hold starts; null = no automatic end |
| ended_at, end_reason | Null while active; then `sold`, `released`, `expired` or `archived` |
| created_by | → admin_users |

Expired holds are released by `hold-expiry.ts` whenever products are read (at
most twice a minute), not by a scheduled job (D37).

Kept in its own table, outside `products`, so public queries and the AI agent
cannot reach it.

### conversations, messages, leads, escalations — Milestone 4 (built)

Migration `0004_agent_conversations.sql`. `messages.product_codes` stores only
product IDs; cards are re-read from inventory whenever they are shown.
`notifications.dedupe_key` is unique, which is what stops duplicates.

| Table | Purpose |
| --- | --- |
| customers | One per person per channel: channel (`web`, `whatsapp`), channel identity (anonymous browser ID or phone number), name if given |
| conversations | customer, channel, state (`agent`, `waiting_for_owner`, `owner`, `closed`), last activity |
| messages | conversation, sender (`customer`, `agent`, `owner`, `system`), text, attached product codes, channel message ID (for duplicate protection), time |
| leads | conversation, product, stage (`inquiry`, `purchase_request`, `reservation_request`, `completed`), summary, what the customer asked for |
| escalations | conversation, reason (`cannot_answer`, `human_requested`, `purchase_request`), question, owner's answer, resolved time |
| notifications | what was sent to the owner, by which route, when; prevents duplicates |

### channel_listings and sync_jobs — Milestone 7

| Table | Purpose |
| --- | --- |
| channel_listings | product, channel (`meta_catalog`), external item ID (our product code), sync state (`pending`, `synced`, `failed`), last synced time, last error, Meta review status if available, fingerprint of what was last sent |
| jobs | type, payload, state, attempts, next attempt time, last error (shared by catalog sync, WhatsApp processing and other background work — D30) |

Products need no change for Meta: name, description, price, condition, brand,
photos, status and the unique product code already map to catalog fields.

## Room for future features

Not built now; noted so current design does not block them.

- **Cart / orders / payments:** new `orders` and `order_items` tables that
  reference `products`. Because each item is unique, an order would place the
  product on hold (`pending`) until paid. An online checkout may also be what
  Meta requires for a Shop (D29).
- **Customer accounts / wishlist / purchase history:** separate `customers`
  table, kept apart from admin users.
- **Discount codes:** separate `discounts` table applied at order level.

## Open questions

1. **Sold items:** currently visible indefinitely; could be hidden after N days.
