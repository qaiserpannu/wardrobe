# Database Schema (planned)

This is the planned structure. Tables are created in the milestone that first
needs them. Once created, the source of truth is the Drizzle schema in
`src/server/db`; keep this document in step with it.

Database: PostgreSQL. All tables have `created_at` and `updated_at` timestamps
unless noted.

## Relationships

```
categories 1 ──── many products 1 ──── many product_images
admin users 1 ──── many audit_log entries
site_settings   (standalone key/value)
ai_knowledge    (standalone FAQ / policy entries)
```

## categories — Milestone 2

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid, primary key | |
| name | text, unique | "Dresses" |
| slug | text, unique | "dresses", used in URLs |
| sort_order | integer | Display order |
| is_active | boolean | Hidden categories stay in the database |

Deleting a category that still has products is blocked; the admin must move or
archive the products first.

## products — Milestone 2

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid, primary key | Internal ID |
| code | text, unique | Human-readable product ID, e.g. `PLW-0042`. Generated from a sequence, never reused |
| slug | text, unique | URL part, e.g. `zara-black-midi-dress-plw-0042` |
| name | text | |
| description | text | |
| category_id | uuid → categories.id | |
| brand | text, nullable | Missing is allowed and shown as "not specified" |
| size | text, nullable | Free text ("M", "UK 10", "32W") — see open question below |
| color | text, nullable | |
| condition | enum | `new_with_tags`, `like_new`, `good`, `fair` |
| price_cents | integer | Price in smallest currency unit |
| status | enum | `draft`, `available`, `sold`, `archived` |
| is_featured | boolean | Shown in homepage "Featured" |
| published_at | timestamp, nullable | Set when first made available; drives "newest" sorting |
| sold_at | timestamp, nullable | |
| search_vector | tsvector, generated | Full-text search over name, description, brand, color |

Visibility rules, enforced in the services layer:

- `draft`, `archived`: never visible publicly or to the AI assistant.
- `available`: visible and can be inquired about.
- `sold`: visible with a SOLD badge, no purchase prompt. (How long sold items
  stay visible will be a site setting.)

Indexes: `status`, `category_id`, `published_at`, `price_cents`, and a GIN index
on `search_vector`.

## product_images — Milestone 2

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid, primary key | |
| product_id | uuid → products.id | Deleted with the product |
| storage_key | text | Location in image storage (not a full URL) |
| alt_text | text, nullable | |
| sort_order | integer | 0 is the main photo |
| width, height | integer | For layout without page jumps |

## site_settings — Milestone 2 (read), Milestone 5 (edit)

| Column | Type | Notes |
| --- | --- | --- |
| key | text, primary key | e.g. `branding`, `contact`, `whatsapp`, `social`, `seo`, `homepage`, `chat_widget`, `ai_assistant` |
| value | jsonb | Validated against a schema per key in code |
| updated_at | timestamp | |

Grouping settings as a few validated JSON documents means new settings do not
need database changes. Secrets (API keys) are never stored here — they stay in
environment variables.

## ai_knowledge — Milestone 4

Approved business information the assistant may quote.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid, primary key | |
| kind | enum | `faq`, `policy` |
| title | text | Question or policy name |
| content | text | Approved answer |
| is_active | boolean | |
| sort_order | integer | |

## Admin users and sessions — Milestone 5

Tables for users, sessions and credentials are created and managed by the
authentication library (see `TECHNICAL_DECISIONS.md` D7). Users have a `role`
column (`admin` initially) to allow more roles later. Passwords are stored only
as salted hashes.

## audit_log — Milestone 5

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid, primary key | |
| admin_user_id | → admin user | |
| action | text | e.g. `product.create`, `product.mark_sold`, `settings.update` |
| entity_type | text | `product`, `category`, `settings` |
| entity_id | text | |
| changes | jsonb | Before/after values of changed fields |
| created_at | timestamp | No `updated_at`; entries are never edited |

## Room for future features

Not built now; noted so current design does not block them.

- **Cart / orders / payments:** new `orders` and `order_items` tables that
  reference `products`. Because each item is unique, an order will move a
  product to a `reserved` status (to be added to the enum).
- **Customer accounts / wishlist / purchase history:** separate `customers`
  table, kept apart from admin users.
- **Discount codes:** separate `discounts` table applied at order level.

## Open questions

1. **Sizes:** free text is flexible but makes the size filter messy ("M" vs
   "Medium"). Option: a managed list of sizes per type (clothing, shoes, waist).
   To be decided with the owner at the start of Milestone 2.
2. **Currency:** which currency and country the shop operates in.
3. **Sold items:** hide after N days, or keep visible indefinitely.
