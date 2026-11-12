# Pre-Loved Wardrobe — Project Overview

## What this is

A website for selling pre-owned Indian and Pakistani clothing (shalwar kameez,
kurtas, lehengas, sarees, anarkalis, menswear, dupattas, accessories). Visitors browse a catalog, view item
details and photos, and contact the owner on WhatsApp to buy. It should feel
like a modern fashion boutique, not a classifieds site.

There is no online checkout. Every sale is completed by the owner in a WhatsApp
conversation.

## Business requirements

- Each item is unique (one piece of stock). An item is a draft, available,
  pending (on hold), sold, or archived.
- Visitors can browse, search, filter and sort the catalog.
- Sold items are clearly marked SOLD and never presented as purchasable.
- Every WhatsApp inquiry names the specific product and its product ID.
- An AI shopping assistant helps visitors find items. It may only state facts
  that come from real inventory records and approved business information.
- The owner manages everything (products, photos, categories, settings, AI
  behaviour) from a secure admin portal, without editing code.

## Design direction

A South Asian fashion boutique: ivory, deep maroon and antique gold; pointed
arches, a gold lattice texture and small ornamental dividers; elegant serif
headings; photography-led layouts; fast pages; works on phone, tablet and
desktop. Rich but restrained — ornament supports the clothes, never competes
with them. Details in `TECHNICAL_DECISIONS.md` D17.

## Scope

In scope, in milestone order (details in `DEVELOPMENT_PLAN.md`; order from M6
on is proposed and awaits owner approval):

1. Foundation, framework and project memory
2. Public website: homepage, catalog, product pages
3. Floating chat widget with WhatsApp click-to-chat
4. AI sales agent on the website chat, grounded in the inventory
5. Admin portal: inventory, statuses and holds, settings, conversation inbox
6. The same AI agent on WhatsApp (official Cloud API)
7. Facebook and Instagram catalog sync
8. End-to-end testing and production readiness

Requirements added 2026-11-12:

- Inventory statuses: available, pending (on hold) and sold are public;
  draft and archived are not. Nothing is permanently deleted (D25).
- One AI agent for website chat and WhatsApp, with conversation history. It
  notifies the owner only for serious buying interest, questions it cannot
  answer, and requests for a human (D24, D26, D27).
- The agent never changes inventory and never confirms a sale; the owner does.
- Products published in admin are sent automatically to a Meta catalog for
  Facebook and Instagram; the website database is the master (D29).
- The WhatsApp number and all contact details are admin settings that take
  effect without a redeployment.

Out of scope until explicitly requested: shopping cart, online payments,
customer accounts, orders, wishlist, discount codes, analytics, sales
reporting, multiple admin roles. The architecture leaves room for these. Note
that Meta may require an online checkout for a Facebook/Instagram Shop (D29).

## Technology stack

| Area | Choice |
| --- | --- |
| Language | TypeScript |
| Framework | Next.js (App Router) — one app for pages and API |
| Styling | Tailwind CSS |
| Database | PostgreSQL (hosted on Supabase, free tier) |
| Database access | Drizzle ORM, with versioned migrations |
| Image storage | Supabase Storage in production, local folder in development |
| Admin login | Better Auth (email + password, no public sign-up) |
| AI | Anthropic Claude via tool calling, behind a swappable provider interface |
| WhatsApp | Official click-to-chat links (`wa.me`) |
| Hosting | Vercel or Netlify (decision open — see `TECHNICAL_DECISIONS.md` D9) |
| Testing | Vitest (logic) and Playwright (browser) |

Reasons for each choice are in `TECHNICAL_DECISIONS.md`.

## Architecture

```
 Visitors            WhatsApp customers        Owner            Facebook / Instagram
    |                       |                    |                      ^
    v                       v                    v                      |
+--------------------------------------------------------------------------------+
| Next.js app                                                                    |
|                                                                                |
|  Public pages   Chat API    WhatsApp webhook   Admin pages + API               |
|      |             |              |            (login required)                |
|      |             v              v                 |                          |
|      |        +----------------------+              |                          |
|      |        | Channel adapters     |              |                          |
|      |        +----------------------+              |                          |
|      |                   v                          |                          |
|      |        +----------------------+              |        +--------------+  |
|      |        | Agent core           |<-- inbox ----+        | Sync worker  |--+
|      |        | history, rules,      |    replies            | (jobs table) |
|      |        | read-only tools      |                       +--------------+
|      |        +----------------------+                              ^
|      v                   v                          v               |
|  +----------------------------------------------------------------------+
|  | Services layer                                                       |
|  | public read functions | conversation records | admin write functions |
|  +----------------------------------------------------------------------+
|              |                                        |
+--------------|----------------------------------------|-------------------------+
               v                                        v
          PostgreSQL                               Image storage
```

Key ideas:

- **One services layer.** Pages, the admin portal, the AI agent and the Meta
  sync all read inventory through the same functions, so they can never
  disagree about what is available.
- **One agent, many channels.** Website chat and WhatsApp are thin adapters
  around the same agent core.
- **The agent cannot change inventory.** It reads public product data and can
  only write conversation records (interest, escalations).
- **The website database is the master.** Meta's catalog is a copy kept in
  step by a job queue with retries and a visible status per product.
- **Admin-only data stays separate.** Hold details and internal notes live in
  tables that public queries never touch.
- **Settings live in the database.** WhatsApp number, branding, contact
  details, homepage content and AI instructions are data, editable in the
  admin portal without redeploying.
- **Secrets stay on the server.** API keys and database credentials are
  environment variables, never sent to the browser.

Planned folders, created when first needed: `src/server/agent` (agent core
and tools), `src/server/channels` (web and WhatsApp adapters),
`src/integrations/meta` (catalog and WhatsApp API clients), `src/server/jobs`.

## Folder structure

```
docs/                    Project memory (this folder)
scripts/                 Small helper files (database setup)
src/
  app/                   Pages and routes
    page.tsx             Homepage
    shop/                Catalog and product pages
    media/               Serves locally stored images (development)
  components/
    ui/                  Generic building blocks (buttons, icons, container)
    layout/              Header, mobile menu, footer
    home/                Homepage pieces
    catalog/             Product card, grid, filters, gallery, pagination
  server/                Server-only code
    db/                  Schema, client, migrations, sample data
    services/            Business logic; the only layer that touches the database
    storage/             Image storage interface (local driver so far)
  integrations/
    whatsapp/            Click-to-chat link builder
  lib/                   Shared helpers (settings schema, URL filters, money)
tests/
  unit/                  Logic tests
  integration/           Service tests against the test database
  e2e/                   Browser tests (desktop, tablet, phone)
```

Folders for chat (`src/components/chat`), AI (`src/server/ai`), auth
(`src/server/auth`) and admin are created in the milestone that needs them.

## Public pages

| Address | Page |
| --- | --- |
| `/` | Homepage: hero, featured, categories, recently added, how it works |
| `/shop` | Catalog with search, filters, sorting and paging (all state in the URL) |
| `/shop/<name>-<product id>` | Product details with gallery and WhatsApp inquiry |
