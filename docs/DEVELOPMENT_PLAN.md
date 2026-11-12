# Development Plan

Rule: one milestone at a time. A milestone is complete only when its completion
criteria are met, it has been tested, and the owner has approved it. Do not
start the next milestone before approval.

Current status is tracked in `PROGRESS.md`.

## Sequence and dependencies

```
M1 Foundation ─> M2 Website ─> M3 WhatsApp widget ─> M4 AI assistant ─> M5 Admin portal
```

- M2 needs M1 (framework, structure).
- M3 needs M2 (product pages to attach context to) and the settings table.
- M4 needs M2's product search services and M3's widget.
- M5 needs M2's data model. It replaces the seed script as the way to manage
  inventory, and gives editing screens for settings that M2–M4 already read
  from the database.

Until M5 exists, products and settings are loaded by a seed script with sample
data, so M2–M4 can be built and tested against real database records.

---

## Milestone 1 — Foundation, framework and memory

Deliverables: technology stack chosen and documented; Next.js project
scaffolded; folder structure; project memory documents; roadmap.

Completion criteria:

- [x] Technology stack selected
- [x] Architecture documented
- [x] Folder structure established
- [x] Project memory files created
- [x] Development roadmap documented
- [x] Lint, type-check and production build pass
- [x] Owner approval (2026-11-12)

## Milestone 2 — Public website

Steps, in order:

1. Database: local PostgreSQL, Drizzle schema and migrations for categories,
   products, product images, site settings. Seed script with sample products.
2. Services layer: public product queries (list, search, filter, sort, get one),
   categories, settings.
3. Design system: colours, typography, buttons, badges, product card.
4. Layout: header with navigation, footer with contact and social links (from
   settings).
5. Homepage: hero, featured items, recently added, browse by category, calls to
   action.
6. Catalog: grid, keyword search, filters (category, size, brand, price,
   condition), sorting (newest, price), paging. Filters live in the URL so
   results can be shared and bookmarked.
7. Product page: photo gallery, details, availability, WhatsApp inquiry button
   that names the product and its ID.
8. Not-found and error pages, page titles and descriptions for search engines.
9. Tests: unit tests for services, browser tests for all pages at desktop and
   mobile sizes, broken-link check.

Completion criteria:

- [x] All pages render correctly on phone, tablet and desktop.
- [x] Search, every filter and both sort orders return correct results.
- [x] Sold items show SOLD and have no purchase prompt; drafts and archived
  items never appear.
- [x] WhatsApp button message contains the product name and ID.
- [x] No broken links or console errors.
- [x] Testing report delivered.
- [ ] Owner approval.

Needed from the owner: brand preferences (colours, logo if any), currency,
category list, a few real product photos if available (otherwise placeholders).

## Milestone 3 — Floating chat widget and WhatsApp

Steps:

1. WhatsApp link builder in `src/integrations/whatsapp`; number read from
   settings.
2. Floating widget on all public pages: open, close, keyboard accessible,
   mobile friendly.
3. Product-aware message: on a product page the pre-filled message includes
   product name and ID.
4. Tests: link format, widget behaviour on desktop and mobile sizes.

Completion criteria: widget works on every public page; correct pre-filled
message with and without product context; number changed in one place; owner
confirms a real conversation opens on their phone and desktop.

Needed from the owner: WhatsApp number in international format.

## Milestone 4 — AI shopping assistant

Steps:

1. Provider interface and Anthropic implementation in `src/server/ai`.
2. Read-only tools: search products, get product, list categories, get
   policies/FAQs — all through the public services layer.
3. Chat API endpoint with input limits and rate limiting.
4. Guardrails: product cards rendered from tool data, product-ID verification,
   exact vs partial match labelling, policy answers only from configured
   content, injection resistance.
5. Widget upgrade: conversation view, product cards with image, price, size,
   condition, availability, link, and per-item WhatsApp button; "talk to a
   person" handoff. The assistant identifies itself as an AI.
6. Evaluation suite: scripted scenarios — match exists, several matches, no
   match, missing information, item becomes sold mid-conversation, off-topic
   request, injection attempts.

Completion criteria: every evaluation scenario passes with no invented product
details; assistant can be switched off and the widget falls back to WhatsApp
only; owner approval.

Needed from the owner: Anthropic API account and key; business policies
(delivery, returns, payment) to be quoted — anything not provided will be
answered with "please ask on WhatsApp".

## Milestone 5 — Admin portal

Steps:

1. Authentication: login, logout, change password, protected routes and APIs,
   one-time setup script for the first admin. No public registration.
2. Dashboard: product counts by status, recent items, recent changes.
3. Product management: create, edit, draft, preview, publish, mark sold,
   archive, delete; multi-photo upload with reordering.
4. Image storage: production storage implementation; file type, size and
   content validation.
5. Category management.
6. Settings: branding, logo, WhatsApp, contact, social links, featured
   products, description, SEO, chat widget.
7. AI management: enable/disable, greeting, behaviour instructions, handoff
   message, FAQs and policies.
8. Audit log of inventory and settings changes.
9. Security review and tests: access restrictions, upload validation, and that
   admin changes appear immediately on the public site and in AI search.

Completion criteria: every item in the Milestone 5 verification list in the
owner's brief passes; owner approval.

Needed from the owner: admin email address; Supabase account (or agreed
alternative) for production database and images.

## Launch (after Milestone 5, or earlier as a preview)

Hosting account, production database, environment variables, custom domain,
backups, final checks. Can be brought forward as a private preview at any time
if the owner wants to see the site on their phone during development.

## Later (not scheduled)

Cart, online payments, customer accounts, orders, wishlist, discount codes,
social media integration, analytics, sales reporting, admin roles, purchase
history. Only on explicit request.
