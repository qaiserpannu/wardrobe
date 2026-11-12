# Technical Decisions

Each decision records what was chosen, why, and what was given up. Add a new
numbered entry when a significant decision is made; do not rewrite history —
mark an old entry "Superseded by Dn" instead.

Status values: **Decided**, **Proposed** (awaiting owner approval), **Open**.

---

## D1 — One Next.js application for website, API and admin

**Status:** Decided (2026-11-12)

Next.js with TypeScript, App Router. Public pages, the admin portal and the
backend API all live in one codebase and deploy as one unit.

- Why: product pages are rendered on the server, so they load fast and search
  engines and link previews (important when sharing items on WhatsApp and social
  media) see full content. One codebase is far easier for a small business to
  maintain than a separate frontend and backend.
- Trade-off: frontend and backend are deployed together. If a mobile app or
  very heavy backend work appears later, the services layer (D3) can be exposed
  as a standalone API without rewriting it.

## D2 — Tailwind CSS for styling

**Status:** Decided (2026-11-12)

- Why: consistent spacing, colour and typography from one theme file; no
  separate stylesheet sprawl; comes preconfigured with Next.js.
- Trade-off: class names in markup are verbose. Mitigated by reusable
  components in `src/components/ui`.
- No component library is installed up front. One will be added only if a
  specific need arises (for example accessible dialogs in the admin portal).

## D3 — A services layer is the only code that touches the database

**Status:** Decided (2026-11-12)

Pages, API routes and AI tools call functions in `src/server/services`. Those
functions are split into public read functions (only ever return publicly
visible products and fields) and admin functions (require an authenticated
admin).

- Why: one place enforces "drafts and archived items are never public" and
  "sold items are marked sold". The website and the AI assistant cannot drift
  apart. Future features (cart, orders) add services rather than rewrite pages.
- Trade-off: a little more structure than querying directly from pages.

## D4 — PostgreSQL, hosted on Supabase

**Status:** Proposed

- Why PostgreSQL: reliable, free, standard; has built-in full-text search,
  which covers catalog keyword search and AI product search without a separate
  search service.
- Why Supabase: free tier includes the database and image storage in one
  account, with a dashboard and backups-by-export. It is ordinary PostgreSQL,
  so moving to another host later is a data export, not a rewrite.
- Trade-off: free-tier projects can be paused after a period with no activity
  and have size limits. Current limits must be checked at sign-up time. If they
  are a problem, Neon (database) plus Cloudflare R2 (images) is the fallback,
  and D5/D6 mean the code barely changes.

## D5 — Drizzle ORM with migrations

**Status:** Decided (2026-11-12)

- Why: the schema is defined in TypeScript, so a mistyped column is caught
  before the code runs. Schema changes are recorded as migration files in the
  repository. Lightweight, no code-generation step.
- The app talks to Postgres through Drizzle rather than the Supabase client
  library, so the database host can change without touching application code.
- Development and automated tests use a local PostgreSQL database, so no cloud
  account is needed to build and verify Milestone 2.
- Driver: `postgres` (postgres.js), with prepared statements off so pooled
  connections (Supabase) work unchanged.

## D6 — Image storage behind a small interface

**Status:** Proposed

One interface (`upload`, `delete`, `publicUrl`) with two implementations: local
folder for development, Supabase Storage for production. The database stores a
storage key per image, not a full URL.

- Why: switching storage providers later means writing one new implementation.
- Images are served through the Next.js image component, which resizes and
  compresses them for each screen size.
- Trade-off: hosting plans cap free image optimisation. If the cap is reached,
  images can be pre-resized at upload time instead.

## D7 — Better Auth for admin login (confirm at Milestone 5)

**Status:** Proposed

Email and password login, with user and session records in our own database.
Public sign-up disabled. The first admin is created by a one-time command-line
setup script that reads the password interactively — never from source code.

- Why: a maintained, widely used library is safer than hand-written login code.
  It stores data in our own database (no extra service or account), and has
  role support for future additional admins.
- Trade-off: one more dependency to keep updated. To be re-checked against
  current options when Milestone 5 starts.

## D8 — AI assistant: tool calling behind a provider interface

**Status:** Proposed (details finalised at Milestone 4)

The assistant uses a language model with tool calling. The model cannot see the
database. It can only call a short list of read-only tools (search products,
get one product, list categories, get business policies), each of which calls
the public services layer (D3).

Accuracy safeguards:

- Product cards shown in the chat are rendered by our code directly from tool
  results — name, price, size, condition, image, link and availability come from
  the database, not from text the model wrote.
- Product IDs mentioned by the model are checked against the tool results for
  that conversation turn; anything unverified is dropped.
- Availability is read fresh on every request; nothing about stock is cached in
  the conversation.
- Policies (delivery, returns, payment) are only stated if configured in admin.
- Visitor messages and product text are treated as data, never as instructions.
  The tools are read-only, so even a successful prompt injection cannot change
  anything or reach non-public data.
- Rate limiting and message-length limits on the chat endpoint.

Provider: Anthropic Claude is the default. All model calls go through one
interface in `src/server/ai`, selected by an environment variable, so another
provider can be added without touching the rest of the app.

- Trade-off: this is the one unavoidable paid service (pay per use; small for a
  site this size). A monthly spending cap will be set on the provider account.

## D9 — Hosting

**Status:** Open — owner to choose before first deployment

| Option | Cost | Notes |
| --- | --- | --- |
| Vercel Pro | about US$20/month | Made by the Next.js team; least effort. The free Hobby plan is restricted to non-commercial use, so a shop needs Pro. |
| Netlify free plan | Free to start | Supports Next.js; commercial use allowed on the free plan. Slightly more setup risk with the newest Next.js features. |

Recommendation: build host-neutral (already the case), use a free preview
deployment during development, and pick between these at launch. Plan terms
must be re-checked at that time.

## D10 — WhatsApp via official click-to-chat links

**Status:** Decided (2026-11-12)

`https://wa.me/<number>?text=<prefilled message>` — the official, free
mechanism. One function builds every link; the number comes from site settings.

- Trade-off: no automated replies or message tracking. The paid WhatsApp
  Business API is not needed for this project.

## D11 — Money and product IDs

**Status:** Decided (2026-11-12)

- Prices are stored as whole numbers in the smallest currency unit (cents) to
  avoid rounding errors. The currency is a site setting.
- Each product has a short human-readable code (for example `PLW-0042`) used in
  WhatsApp messages, the AI assistant and the admin portal, in addition to its
  internal database ID.

## D12 — Testing approach

**Status:** Decided (2026-11-12)

Vitest for logic (services, WhatsApp link builder, AI guardrails) and Playwright
for real-browser checks at desktop and mobile sizes. Both are added in
Milestone 2 when there is something to test. A milestone is complete only when
lint, type-check, build and tests pass and the result has been checked in a
browser.

## D13 — Dependencies are added only when used

**Status:** Decided (2026-11-12)

Milestone 1 installs only the framework. Database, auth, AI and test packages
are installed in the milestone that first needs them, so nothing unused or
untested sits in the project.

## D14 — Product data is always live; only settings and categories are cached

**Status:** Decided (2026-11-12)

Product lists and product pages read the database on every visit. Site settings
and the category list, which appear on every page and change rarely, are cached
for about a minute.

- Why: showing a sold item as available is the worst mistake this site can
  make, so availability is never served from a cache. Caching the page frame
  (header, footer, hero) still lets pages appear instantly while products
  stream in.
- Trade-off: each visit costs a few database queries. That is negligible at
  this size. If traffic grows, product caching with explicit invalidation on
  admin saves can be added in one place (`src/server/services/cached.ts`).
- Consequence: building the site needs a database connection, because settings
  are read at build time.
- Update (2026-11-12): two development-mode errors on the homepage were fixed.
  (1) Product sections call `await io()` before their first query, so opening a
  database connection (the password handshake generates a random value) never
  happens while Next.js prerenders the page frame. Any new component that reads
  uncached data without first awaiting `params`/`searchParams` needs the same.
  (2) The cached settings and categories now use a browser-side lifetime
  (`stale`) of 5 minutes instead of 30 seconds; Next.js leaves anything shorter
  out of the instantly shown page frame. The server still refreshes them every
  minute, but a visitor who keeps browsing without reloading may see an old
  setting for up to 5 minutes.
- Consequence: a product address that does not exist shows the not-found
  message but, because the page frame is sent first, the response code is 200
  with a "noindex" tag rather than 404. Addresses outside `/shop/` return a
  true 404. The product page renders `NotFoundMessage` directly instead of
  calling `notFound()`: throwing after the frame was sent made the browser log
  an error (React 419) when the visitor clicked away from such a page.

## D15 — Catalog filters live in the URL

**Status:** Decided (2026-11-12)

Search text, filters, sort order and page number are all query parameters
(`/shop?category=dresses&size=M&max=30`). The filter panel is an ordinary form
that works without JavaScript; with JavaScript it applies changes instantly.

- Why: filtered views can be shared and bookmarked, the back button works, and
  the AI assistant (Milestone 4) can link to a filtered catalog.
- All URL input is validated by `parseCatalogParams` before reaching a query.

## D16 — Sizes and brands are free text for now

**Status:** Decided (2026-11-12) — revisit at Milestone 5

Size and brand are plain text on each product; the filter lists are built from
the values in use. Sizes are sorted naturally (S, M, L, then numbers).

- Why: second-hand stock has mixed sizing systems (letters, waist, shoe sizes).
- Trade-off: inconsistent typing ("M" vs "Medium") would create duplicate
  filter options. The admin product form will offer existing values as
  suggestions to prevent this.

## D17 — Look, categories and other defaults

**Status:** Theme decided by owner (2026-11-12); currency and remaining
defaults still to confirm

The shop sells Indian and Pakistani clothing, so the design follows that:

- Colours: ivory background, deep maroon for buttons and highlights, antique
  gold for decorative lines only (it is too light for text), deep maroon
  footer. Tokens are in `src/app/globals.css`.
- Motifs: pointed (Mughal-style) arches for the hero image, category tiles and
  product picture backdrops; a quiet gold lattice (jali) background texture; a
  small gold diamond divider under headings; a scalloped gold edge on the
  footer. Reusable pieces: `src/components/ui/Ornament.tsx` and the
  `.pattern-jali` / `.edge-scallop` classes.
- Fonts: Cormorant Garamond headings, Geist body text.
- Categories: Shalwar Kameez, Kurtas, Lehengas, Sarees, Anarkalis, Menswear,
  Dupattas, Accessories (data, editable later in admin).
- An announcement strip above the header (`branding.announcement` setting).
- Still assumed, owner to confirm: currency USD; sold items stay visible
  indefinitely, listed after available items.

## D18 — Placeholder artwork for sample products

**Status:** Decided (2026-11-12)

Sample products use generated illustrations of South Asian garments (suit,
kurta, lehenga, saree, anarkali, sherwani, dupatta, jewellery, shoes, bag)
(`src/server/db/seed/artwork.ts`) because no real photographs exist yet. They
go through the same storage and image pipeline that real photos will.

## D19 — Stored image names include a content fingerprint

**Status:** Decided (2026-11-12)

Images are served with "never changes" caching so repeat visits are fast. To
keep that safe, every stored file name contains a short fingerprint of its
contents (`plw-0001-1-3fa9c2d1.webp`). A replaced photo gets a new name, so
browsers and the image optimiser can never show an outdated picture. Admin
uploads in Milestone 5 must follow the same rule.

## D20 — Extra product details for South Asian clothing

**Status:** Decided by owner (2026-11-12)

Products gained fabric, number of pieces, stitched/unstitched, occasion and an
imperfections note. All are optional. The catalog can be filtered by the first
four, and fabric is included in keyword search.

- Fabric is free text (like brand and size, D16). Stitching and occasion are
  fixed lists defined in `src/lib/product-options.ts`; changing the lists needs
  a small database migration.
- The product page always shows an "Imperfections" section. If nothing was
  recorded it says so and invites a question — it never claims the item is
  flawless.
- Currency confirmed as USD.

## D21 — Photo-assisted listing and photo enhancement (planned for Milestone 5)

**Status:** Proposed — approach to confirm when Milestone 5 starts

The owner wants uploading a photo to pre-fill product details and to make
photos look better for selling. Both belong to the admin product form.

- Pre-fill: the uploaded photos are sent to the AI provider (the same
  swappable interface as the shopping assistant, D8), which suggests name,
  category, colour, likely fabric, occasion, pieces and a draft description.
  Suggestions fill the form as a draft for the owner to check and correct;
  nothing is published automatically. Brand, size, price, condition and
  imperfections must be confirmed or entered by the owner, because a photo
  cannot reliably show them. Visible flaws the AI notices are offered as
  suggestions for the imperfections note.
- Enhancement: automatic straightening/cropping to the shop's 4:5 shape,
  brightness and white-balance correction, sharpening and resizing, done on
  our own server at no cost. Optional background clean-up (plain or soft
  studio backdrop) would use an AI background-removal step.
- Rule: enhancement must never change the garment itself — no colour shifts
  beyond correcting lighting, and no retouching of marks, fading or damage.
  This is second-hand selling; buyers must see the real item. The original
  photo is always kept.
- Cost: a small per-listing AI charge for pre-fill (and for background
  clean-up if chosen).

## D22 — Categories will be owner-managed, with possible grouping

**Status:** Open — to settle before Milestone 5 category management

Categories are already data, not code, so the admin portal will let the owner
add, rename, reorder and hide them. Open question for the owner: whether to
group them (for example Women / Men / Kids, with Lehengas and Kurtis under
Women). Grouping would add a parent field to categories and a grouped menu.
