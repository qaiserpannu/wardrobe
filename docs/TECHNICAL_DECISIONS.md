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
  happens while Next.js prerenders the page frame. The shop and product
  pages got the same call later the same day: awaiting `params` or
  `searchParams` turned out not to be enough, because Next.js also prefetches
  pages with those values filled in. Every component that reads uncached data
  needs `await io()`.
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

## D22 — Categories are grouped (two levels)

**Status:** Decided by owner (2026-11-12)

Categories form a two-level tree: groups (Women, Men, Kids, Accessories) with
categories inside them (Women > Lehengas, Kurtis...). Stored as a `parent_id`
on the categories table. Products belong to a category inside a group; a group
with no children still works as a plain category.

- A group address (`/shop?category=women`) shows everything inside the group.
- Switching off a group hides everything inside it.
- Menu: desktop shows groups with a drop-down of their categories (the group
  name is itself a link, so it works on touch screens); the phone menu lists
  groups with their categories underneath.
- The actual groups and categories are sample data. The owner will manage them
  in the admin portal (Milestone 5): add, rename, reorder, hide, move between
  groups. Only two levels are supported, on purpose.

## D23 — Photo clean-up and listing pre-fill must be free (for now)

**Status:** Decided by owner (2026-11-12); supersedes the paid parts of D21.
On 2026-11-12 the owner said they were "happy with recommendations 1 and 2",
read as accepting both free pre-fill options below (form helpers, and an AI
provider's free allowance) — to be confirmed with the owner.
Technical choices to be verified by a hands-on trial at the start of
Milestone 5 — nothing here has been tested yet.

The owner wants no per-use charge for photo clean-up or pre-fill.

- Free and reliable (runs on our own server, no AI): crop to the shop's 4:5
  shape, lighting and white-balance correction, sharpening, resizing.
- Background clean-up, free route: an open-source background-removal model
  running in the owner's browser at upload time, so there is no service fee
  and photos do not leave the device for this step. The model's licence must
  allow commercial use (check before choosing — some popular ones do not).
  Expected weaker than paid services on sheer dupattas, net and fine
  embroidery edges; must be trialled on real product photos, with a simple
  "use original instead" switch.
- Pre-fill, free route, in order of reliability:
  1. Main colour read directly from the photo's pixels (no AI).
  2. Form helpers: suggestions from values already used in the shop, "copy
     details from a similar product", and sensible defaults.
  3. Category guess from an open-source image model in the browser — to be
     trialled; kept only if it is right often enough to save time.
  4. Optional: a hosted AI model's free allowance for fuller suggestions
     (description, fabric, occasion). Free allowances have daily limits, can
     change or end without notice, and may let the provider use uploaded
     photos to improve their models. Off by default; the owner decides.
- Honest limit: without a capable (paid or free-allowance) AI model, fabric,
  occasion and a written description cannot be suggested reliably from a
  photo. Brand, size, price, condition and imperfections always come from the
  owner.
- The rule from D21 still applies: clean-up never alters the garment, and the
  original photo is kept.
- Because the AI provider is swappable (D8), moving to a paid model later is
  a settings change, not a rebuild.

## D24 — One AI sales agent, many channels

**Status:** Decided in principle by owner (2026-11-12); details at Milestone 4

The AI shopping assistant becomes a sales and customer-service agent that
serves both the website chat and WhatsApp. It is built once:

```
Website widget ─┐
                ├─> channel adapters ─> agent core ─> tools ─> services layer ─> database
WhatsApp ───────┘                          │
                                           └─> AI provider (swappable, D8)
```

- Agent core (`src/server/agent`): conversation history, rules, tool calling,
  interest stages, escalation. It knows nothing about channels.
- Channel adapters turn a channel's messages into the core's format and render
  replies for that channel (product cards on the website; photo messages with
  captions on WhatsApp). Adding a channel later (Instagram DMs, Messenger)
  means writing one adapter.
- Both channels share the inventory database, business knowledge and
  conversation logic, so they cannot give different answers.
- Conversation history is stored per customer per channel, so returning
  customers are not asked the same questions again. Website visitors are
  recognised by an anonymous browser ID; WhatsApp customers by their number.
- All accuracy rules in D8 apply unchanged.

## D25 — Inventory statuses: draft, available, pending, sold, archived

**Status:** Decided by owner (2026-11-12). To be added to the data model as
the next piece of Milestone 2 work, once the owner gives the go-ahead.

| Status | Website | AI agent | Meta catalog |
| --- | --- | --- | --- |
| Draft | Hidden | Unknown to it | Not listed |
| Available | Shown, can be inquired about | Offered | In stock |
| Pending (on hold) | Shown with an ON HOLD badge, listed after available items, no buy prompt | Not offered as available; says it is on hold if asked about it | Out of stock |
| Sold | Shown with SOLD badge, listed last, no buy prompt | Not offered; says it is sold if asked | Out of stock, then removed after a set period |
| Archived | Hidden | Unknown to it | Removed |

- Allowed changes: draft → available; available ⇄ pending; pending → sold;
  available → sold; sold → available (to undo a mistake); anything → archived.
  Only the owner changes status, in admin. The agent never does.
- Nothing is permanently deleted. "Delete" in admin means archive. Every
  status change is recorded with time and admin user.
- Hold details (customer name, contact, hold date, expected expiry, internal
  notes) live in a separate admin-only table. They are never included in
  public product data, so neither the website nor the agent can reveal them.
- (Updated by D31: expiry after 72 hours is approved.) Automatic hold expiry is possible (a daily job returning expired holds to
  available, with a notification) but will not be built without the owner's
  approval; if built it is a setting, off by default.
- Featured, recently-added and related lists contain available items only.

## D26 — What the agent may and may not do

**Status:** Decided by owner (2026-11-12)

- Inventory and settings are read-only for the agent. This replaces the
  earlier "read-only tools only" rule with a precise one: the agent has three
  record-keeping tools that write only to conversation records —
  `record_purchase_interest`, `escalate_question`, `request_human`.
- Interest stages on a conversation's lead record: inquiry (asking),
  purchase request (clearly wants to buy a specific item), reservation
  request (asks to hold it), completed sale. Only the owner can set
  "completed sale", and only the owner changes product status.
- The agent tells the customer the truth about what happens next: "I've
  passed this to the owner, who will confirm" — never "it's yours" or "it's
  reserved".
- The agent never invents availability, details, prices, discounts, delivery,
  returns, payment methods or any other business fact. If the answer is not in
  the inventory or approved knowledge, it says it needs to confirm and
  escalates (scenario B).
- It always identifies itself as an AI assistant and never claims to be the
  owner or a human.

## D27 — Owner notifications and human handoff

**Status:** Decided by owner (2026-11-12)

The owner is notified in exactly three situations; ordinary browsing and
questions never notify.

- A. Serious buying interest: customer name if known; contact details where
  available and permitted (WhatsApp number on WhatsApp; whatever the visitor
  chose to give on the website); product name, ID, price and link; a short
  conversation summary; what the customer agreed to or asked for.
- B. Agent cannot answer: the question and conversation context. The
  customer is told the agent needs to confirm. The conversation waits for the
  owner; the owner's answer is passed on and the agent resumes. The owner can
  choose to save the answer as approved knowledge so it need not be asked
  again.
- C. Customer asks for a human: immediate handoff offer and notification.

Conversation states: agent active → waiting for owner → owner active (agent
paused) → handed back to agent → closed.

Notification delivery: email from Milestone 4 (free); the admin inbox from
Milestone 5; optionally a WhatsApp message to the owner's own number from
Milestone 6. Duplicate notifications for the same conversation are merged.

Privacy: conversations and phone numbers are personal data. A privacy notice
in the widget and on WhatsApp, a retention period setting, and deletion on
request are part of Milestone 8 at the latest.

## D28 — WhatsApp: official Cloud API with our own agent

**Status:** Proposed (researched 2026-11-12). Facts marked "verify" came from
secondary sources because Meta's own documentation could not be opened from
the development environment; re-check them at the start of Milestone 6.

Recommendation: connect our own agent directly to Meta's WhatsApp Business
Platform (Cloud API). No third-party WhatsApp agent or reseller is needed.

- How it works: Meta sends each incoming customer message to a secure address
  on our site (a webhook); our agent decides the reply and sends it back
  through the API. Meta hosts the API; there is no platform subscription fee.
- Allowed use: Meta banned general-purpose AI chatbots from the platform in
  January 2026, but AI that serves a business's own customers (support,
  sales) remains allowed. Our agent only discusses this shop, which keeps it
  on the permitted side. Meta's policy also expects a clear path to a human,
  which D27 provides.
- Costs (verify current rates):
  - Template messages (messages we start, or send more than 24 hours after
    the customer's last message) are charged per message.
  - Replies inside the 24-hour window ("service messages") were free until
    2026-10-01 and are now charged per message. Third-party sources report a
    free allowance of 1,000 service messages per number per month; this was
    not confirmed on Meta's own page.
  - Rates depend on the customer's country and can change quarterly.
  - Plus AI model usage per conversation (D8).
  - A cost guard (monthly message cap, alert) is part of the build.
- The 24-hour rule: free-form replies are only allowed within 24 hours of the
  customer's last message. If the owner answers an escalated question later
  than that, the reply must use a pre-approved template message.
- Phone number: a number used with the Cloud API cannot also be used in the
  ordinary WhatsApp app in the usual setup. Options:
  1. A dedicated new number for the shop (recommended): simplest and fully
     supported; the owner reads and replies through the admin inbox, which
     works in a phone browser.
  2. "Coexistence": keep using the WhatsApp Business app on the same number
     alongside the API. It exists, but appears to be offered through Meta's
     partner sign-up flow and has limits (verify whether a business can enable
     it directly).
- Until Milestone 6, WhatsApp is click-to-chat only (Milestone 3) and
  conversations go straight to the owner's phone, as now.
- The WhatsApp number is a site setting. When the Cloud API number goes live,
  changing that one setting points every link on the site at it.
- Alternatives considered: third-party "WhatsApp AI agent" products and
  business solution providers add monthly fees or per-message mark-ups and
  put the conversation logic outside our control; Meta's own Business AI
  agent would not use our inventory rules or accuracy safeguards. Unofficial
  WhatsApp automation libraries break Meta's terms and risk the number being
  banned — never to be used.

Needed from the owner for Milestone 6: Meta business portfolio (Business
Manager) with business details; whether to use a new dedicated number or
attempt coexistence; display name; a payment method on the WhatsApp Business
Account; business verification if Meta requests it.

## D29 — Facebook and Instagram catalog sync

**Status:** Proposed (researched 2026-11-12); same caveat as D28 about
secondary sources. Re-check at the start of Milestone 7.

Feasible. Facebook and Instagram shops read from one Meta catalog in Commerce
Manager; we push products into that catalog through Meta's official catalog
API.

- Master data: the website database. Meta is a destination only; nothing is
  read back into inventory.
- No duplicates: our product ID is the catalog item ID, so sending a product
  again updates it rather than creating a second one.
- Reliability: changes are written to a job queue in our database in the same
  step as the product change, then sent by a background worker with retries.
  Each product has a visible sync status and a manual retry. A scheduled
  full comparison repairs drift.
- Availability: Meta's catalog supports "in stock" and "out of stock" (and a
  "used" condition), which covers available, pending and sold as in D25.
- Simpler fallback if API access is delayed: a product feed file on our site
  that Meta collects on a schedule (about hourly). Less immediate for "sold",
  so the API is preferred.
- Requires a live public website with cloud-hosted photos, and scheduled
  background jobs on the hosting platform.

What the sync cannot guarantee:

- Meta reviews each shop and each product against its commerce policies.
  Review can take from hours to (reportedly) weeks for a new shop, and items
  can be rejected. Sync status in admin will show "sent" separately from
  Meta's review result where Meta exposes it.
- A status change reaches Meta within moments of the job running, but Meta's
  own apps may show the old state for a short time afterwards.

Important eligibility risk — website checkout:

- Meta ended in-app checkout in 2025. A Shop now sends buyers to the seller's
  website to pay, and Meta requires a checkout address on a domain the seller
  owns for the Shop to be visible.
- This site has no online checkout by design (sales are completed on
  WhatsApp). It is therefore uncertain whether Meta will approve a Shop for
  it. This must be tested with Meta early in Milestone 7, before building the
  full sync.
- Options if Meta refuses: (a) add a simple online checkout or "reserve with
  deposit" to the website (currently out of scope, a future feature);
  (b) use the catalog without a Shop — for catalog ads and for the WhatsApp
  Business catalog — and keep posting to Instagram with links; (c) both.
- Shops are only available in supported countries; the owner's country must
  be confirmed.
- Second-hand clothing: the catalog has a "used" condition, but Meta's
  commerce policy for pre-owned items should be confirmed before applying.

Needed from the owner for Milestone 7: Facebook Page for the shop; Instagram
professional (business) account linked to that Page; Meta business portfolio
owning both; Commerce Manager account and catalog; domain verification for
the shop's website; contact details and returns/refund policy shown on the
website; the country the business operates from.

## D30 — Background jobs

**Status:** Proposed

Milestones 6 and 7 need work that happens outside a page request: sending
queued catalog updates, retrying failures, processing incoming WhatsApp
messages, optional hold expiry. Approach: a jobs table in our database plus a
scheduled trigger from the hosting platform (and immediate processing after a
change where possible). No separate queue service. This affects the hosting
choice (D9): the chosen host must support scheduled jobs and requests long
enough for an AI reply.

## D31 — Owner decisions on the expanded roadmap (2026-11-12)

**Status:** Decided by the owner

- **Milestone order approved** as in `DEVELOPMENT_PLAN.md` (WhatsApp agent as
  its own milestone after the admin portal).
- **Market:** United States only, local to Tampa, Florida. Customers collect
  in person. This settles the country question in D28 and D29 (US WhatsApp
  rates; Meta Shops are offered in the US).
- **Payment:** Zelle, Cash App, or cash at pickup. No online payment and no
  online checkout for now; a checkout is a possible future feature. The
  Meta Shop eligibility risk in D29 therefore stays open and must be tested
  with Meta at the start of Milestone 7; fallback is the catalog without a
  Shop.
- **Facebook and Instagram messages:** go to Messenger / Instagram direct
  messages and are answered by the owner personally. No AI agent on those
  channels for now. D24 keeps the door open (a new channel adapter) but
  nothing is planned.
- **WhatsApp number:** +1 813 990 7900 (stored as `18139907900`). It is a
  setting, loaded into sample data through `SEED_WHATSAPP_NUMBER`, and will
  be editable in admin. Whether the same number or a new dedicated one is
  used for the AI agent on the Cloud API (D28) is still to be decided in
  Milestone 6 - moving a number to the Cloud API normally stops it working
  in the ordinary WhatsApp app.
- **Hold expiry:** approved. A hold ends automatically after 72 hours and the
  item returns to available. The period is a setting (default 72 hours) and
  the owner can extend or end a hold by hand. Built in Milestone 5 together
  with holds; needs the scheduled job from D30. The expiry is recorded in the
  status history like any other change.
- **Photo assist (D23):** confirmed - both free pre-fill options.
- **PENDING status:** built in Milestone 2 (public side). Shown as "On hold";
  ordering is available, on hold, sold; no inquiry button; search-engine data
  says out of stock; the "hide" filter leaves only available items.

## D32 — How the AI sales agent is built (Milestone 4)

**Status:** Built; real-model evaluation still to be run (needs the owner's AI key)

- **Layers.** `src/app/api/chat` is the website channel adapter (anonymous
  visitor cookie, input checks, card shaping). `src/server/agent/core.ts` is
  the channel-neutral core. `src/server/agent/providers` holds the AI
  provider behind one small interface (`AgentModel.runTurn`); the provider
  owns the tool-calling loop because each vendor formats it differently.
- **Provider and model.** Anthropic Claude through the official SDK
  (`@anthropic-ai/sdk`). Model from `AI_MODEL` (default `claude-opus-5-5`),
  effort from `AI_EFFORT` (default `low`, suited to short chat turns). The
  owner may choose a cheaper model; that is a cost/quality decision for the
  owner, to be made after the evaluation. Instructions and tool list are
  identical on every request so the provider caches them. Refusals fall back
  through the API's server-side fallback.
- **Tools.** Read-only: `search_products`, `get_product`, `list_categories`
  (all through the public services). Record-keeping only:
  `record_purchase_interest`, `escalate_question`, `request_human`. Tool
  input is validated with zod; anything else is an error result.
- **Approved knowledge** (`ai_knowledge` table) is placed in the
  instructions. Seeded with what the owner has said: Tampa pickup; Zelle,
  Cash App or cash; the owner confirms every sale.
- **Guardrails enforced in code, not left to the model:**
  - Every product ID in a reply is checked against the public inventory. If
    one does not exist the whole reply is replaced by a safe message.
  - Product cards are built by our code from current records for the IDs
    mentioned; stored messages keep only the IDs, so an item sold later
    shows as sold in old messages.
  - A purchase request for an item that is not `available` is rejected by
    the tool. No tool can change a product.
  - Hold details are not in any table the agent's code path reads.
  - Limits: 1,000 characters per message; 8 messages a minute and 120 a day
    per visitor; 30 requests a minute per network address; a site-wide daily
    ceiling (`ai_assistant.dailyMessageLimit`, default 500) to cap cost.
  - Same-origin check on the chat API; visitor ID in an httpOnly cookie.
  - Any provider failure, refusal or empty answer gives a fixed fallback
    reply and highlights the WhatsApp route.
- **Conversation memory.** Messages are stored as text per customer per
  channel; the last 30 are replayed to the model as plain text each turn.
  A conversation idle for 30 days is closed and a new one starts.
- **Notifications.** Recorded in `notifications` with a de-duplication key
  (one per conversation + product + request type; one per distinct question;
  one human request per conversation per day). Emailed through Resend only
  if `RESEND_API_KEY`, `NOTIFY_EMAIL_FROM` and the `notifyEmail` setting are
  present; otherwise recorded for the Milestone 5 inbox. The email path has
  not been run against the real service.
- **States.** B and C move the conversation to `waiting_for_owner`. Until
  the admin inbox exists (M5) the agent keeps answering; the owner replies
  to the customer outside the system (WhatsApp or the contact they gave).
- **Switching off.** The assistant panel shows only when
  `ai_assistant.enabled` is true and a provider is configured; otherwise the
  widget is the Milestone 3 WhatsApp panel. The provider check happens when
  the site is built, so adding or removing the key needs a redeploy; the
  on/off setting takes effect within a minute.
- **Testing.** `AI_PROVIDER=test` selects a fixed-rule stand-in used only by
  the browser tests. Database tests inject scripted models. Neither proves
  how the real model behaves; that needs an evaluation run with a key.

## D33 — Owner decisions for the AI agent (2026-11-13)

**Status:** Decided by the owner

- **Model:** the cheapest option. Default is now Claude Haiku 5.5
  (`claude-haiku-5-5`, $0.10 per million input tokens and $0.50 per million
  output tokens for prompts under 100K tokens). There is no free tier on
  the Anthropic API. `AI_MODEL` can still override it. Haiku has no
  server-side refusal fallback, so that option is only sent for larger
  models; a declined request gets the fixed safe reply.
- **Returns:** none. All sales are final. Added to the approved shop
  information, so the agent answers this directly.
- **Notifications:** wait for the admin inbox (Milestone 5). No email
  service is set up; notifications are recorded only.
- **Evaluation:** `npm run eval:agent` runs 17 realistic conversations
  against the real model on the test database and checks the outcomes
  (71 checks) and reports token usage. It could not be run in the cloud
  development environment, which cannot use the owner's API key; it must be
  run on the owner's computer.

## D34 — First evaluation against the real model (2026-11-13)

**Status:** Recorded

Run by the owner on their computer with Claude Haiku 5.5: 70 of 71 checks
passed across 17 conversations; the one failure was a fault in the check
itself (it matched the word "sure" inside "make sure"), not in the reply.
Usage for 21 replies: 63,676 input tokens, 82,986 cached, 4,875 output;
2.0 seconds per reply on average. At list prices that is about one US cent
for the whole run, roughly a twentieth of a cent per reply.

Changes made from reading the transcripts (not yet re-run):

- After passing a question on, the model said the owner "hasn't replied
  yet", as if it had waited. Tool result and instructions reworded; checks
  added.
- It offered to "confirm measurements from our records"; measurements are
  not recorded. Instruction and check added.
- For an on-hold item it offered to "pass your interest"; clarified that
  only a question can be passed, not a purchase request.
- Lists of several items were long; asked for one short line each.

Second run (2026-11-13, after the wording fixes): 73 of 74 checks passed;
the one failure was again the check (it did not recognise "Neither the
brand nor the size is recorded"). Cost and speed unchanged. One real fault
was found by reading the transcript: asked to buy the on-hold sage green
saree, the model first said no such saree existed, "not even sold or on
hold", then corrected itself on the next message. Cause: a normal search
returned only available items, so the model could not see the item. Fixed
in code rather than by instruction: every search now also lists matching
items that are on hold or sold, by name and status
(`matching_items_not_available`). Test and evaluation check added.

Third run (2026-11-13, after the search fix): 75 of 75 checks passed; the
on-hold saree was correctly described as on hold in the first reply. About
one cent for the run, 2.1 seconds per reply. Remaining quirks seen in the
transcripts, typical of the lowest-cost model and not safety issues: it
once asked "Would you like to reserve it?" (instruction and check added
afterwards, not re-run), and once said it was "correcting" an earlier
message that was already correct. If these bother the owner, the next
model up (`AI_MODEL=claude-sonnet-5-5`) costs about 20 times more.
