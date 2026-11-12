# Pre-Loved Wardrobe — Project Overview

## What this is

A website for selling pre-owned Indian and Pakistani clothing (shalwar kameez,
kurtas, lehengas, sarees, anarkalis, menswear, dupattas, accessories). Visitors browse a catalog, view item
details and photos, and contact the owner on WhatsApp to buy. It should feel
like a modern fashion boutique, not a classifieds site.

There is no online checkout. Every sale is completed by the owner in a WhatsApp
conversation.

## Business requirements

- Each item is unique (one piece of stock). An item is either a draft,
  available, sold, or archived.
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

In scope (in milestone order — see `DEVELOPMENT_PLAN.md`):

1. Foundation, framework and project memory
2. Public website: homepage, catalog, product pages
3. Floating chat widget with WhatsApp click-to-chat
4. AI shopping assistant grounded in the inventory
5. Admin portal

Out of scope until explicitly requested: shopping cart, online payments,
customer accounts, orders, wishlist, discount codes, analytics, sales
reporting, multiple admin roles. The architecture leaves room for these.

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
Visitor's browser                         Owner's browser
      |                                         |
      v                                         v
+-----------------------------------------------------------+
| Next.js app                                               |
|                                                           |
|  Public pages      Chat API           Admin pages + API   |
|  (home, catalog,   (AI assistant)     (login required)    |
|   product)             |                     |            |
|       |                v                     |            |
|       |         AI module: model             |            |
|       |         + read-only tools            |            |
|       v                v                     v            |
|  +-----------------------------------------------------+  |
|  | Services layer (products, categories, settings)     |  |
|  | public read functions  |  admin write functions     |  |
|  +-----------------------------------------------------+  |
|            |                          |                   |
+------------|--------------------------|-------------------+
             v                          v
        PostgreSQL                 Image storage
```

Key ideas:

- **One services layer.** Pages, the admin portal and the AI assistant all read
  inventory through the same functions, so they can never disagree about what is
  available.
- **The AI only gets read-only tools.** It can search and look up public product
  data. It has no code path to change anything.
- **Settings live in the database.** WhatsApp number, branding, contact details,
  homepage content and AI instructions are data, editable in the admin portal.
- **Secrets stay on the server.** API keys and database credentials are
  environment variables, never sent to the browser.

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
