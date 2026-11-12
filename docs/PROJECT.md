# Pre-Loved Wardrobe — Project Overview

## What this is

A website for selling pre-owned clothing. Visitors browse a catalog, view item
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

Clean, elegant, minimal. Neutral colours with a restrained accent colour, modern
typography, photography-led layouts, fast pages, and a layout that works on
phone, tablet and desktop.

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
public/                  Static files (logo, icons)
src/
  app/                   Pages and API routes
    (public site)        Milestone 2
    admin/               Milestone 5
    api/                 Chat and admin endpoints
  components/
    ui/                  Generic building blocks
    layout/              Header, navigation, footer
    catalog/             Product cards, filters, gallery
    chat/                Chat widget and assistant UI
    admin/               Admin portal components
  server/                Server-only code
    db/                  Schema, client, migrations
    services/            Business logic; the only layer that touches the database
    ai/                  Provider interface, tools, guardrails
    storage/             Image storage interface
    auth/                Admin authentication
  integrations/
    whatsapp/            Click-to-chat link builder
  lib/                   Shared helpers
  types/                 Shared types
tests/                   Automated tests
```
