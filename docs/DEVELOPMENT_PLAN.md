# Development Plan

Rule: one milestone at a time. A milestone is complete only when its completion
criteria are met, it has been tested, and the owner has approved it. Do not
start the next milestone before approval.

Current status is tracked in `PROGRESS.md`.

## Sequence and dependencies

Roadmap revised 2026-11-12 after the owner added the AI sales agent on
WhatsApp, Facebook/Instagram catalog sync and the PENDING status. The order
below was **approved by the owner on 2026-11-12** (D31).

```
M1 Foundation
M2 Public website (incl. PENDING status in the core data model)
M3 WhatsApp click-to-chat widget, number from settings
M4 AI sales agent — core, on the website chat
M5 Admin portal (inventory, statuses and holds, settings, conversation inbox)
M6 AI sales agent on WhatsApp (official Cloud API)
M7 Facebook and Instagram catalog sync
M8 End-to-end testing and production readiness
```

Why this order (it differs from the owner's suggested list in one way: the
WhatsApp side of the AI agent is its own milestone, after the admin portal):

- The agent is built once, channel-neutral, in M4. The website chat is the
  first channel because it needs no outside accounts and costs nothing per
  message, so the agent's accuracy can be proven before real customers on
  WhatsApp meet it.
- "AI cannot answer → owner replies → agent resumes" needs a secure place for
  the owner to read and answer conversations. That is the admin inbox, which
  needs admin login (M5). In M4 escalations are recorded and the owner is
  notified; replying inside the system arrives with M5.
- The WhatsApp Cloud API needs a Meta business portfolio, a dedicated phone
  number, display-name approval and a public HTTPS address. The same Meta
  business setup is needed for the catalog (M7), so M6 and M7 share their
  prerequisites and sit together. The owner can start the Meta paperwork any
  time; it does not block M3–M5.
- M7 needs M5 (products are created and marked sold in admin) and a live
  public site with cloud image storage (Meta fetches product pages and photos).
- PENDING is part of the product data model from M2 onward; changing a status
  by hand arrives with M5.

Deployment: a private preview deployment is needed by M6 at the latest
(WhatsApp webhooks) and may be brought forward on request.

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
- [x] PENDING / ON HOLD status in the data model and on the public website
  (D25, D31): shown as "On hold", listed between available and sold, no
  inquiry button.
- [x] Owner approval (2026-11-12).

Needed from the owner: brand preferences (colours, logo if any), currency,
category list, a few real product photos if available (otherwise placeholders).

## Milestone 3 — WhatsApp click-to-chat widget

Steps:

1. Floating widget on all public pages: open, close, keyboard accessible,
   mobile friendly.
2. Uses the existing link builder (`src/integrations/whatsapp`); the number is
   read from site settings, never from code.
3. Product-aware message: on a product page the pre-filled message includes
   product name and ID.
4. `chat_widget` settings (on/off, greeting text, position).
5. Tests: link format, widget behaviour on desktop and mobile sizes.

Completion criteria:

- [x] Widget on every public page; opens, closes, works from the keyboard,
  fits phone, tablet and desktop screens.
- [x] Correct pre-filled message with and without product context; sold and
  on-hold items never get a "buy" message.
- [x] Number and widget texts come from settings only, no code change needed.
- [x] Owner confirms a real conversation opens on phone and desktop.
- [x] Owner approval (2026-11-13, "move to the next step").

WhatsApp number: provided (D31), already in the sample data.

## Milestone 4 — AI sales agent (core, website chat)

One agent, built channel-neutral (D24), first used in the website widget.

Steps:

1. Agent core in `src/server/agent`: provider interface (D8), conversation
   store with history, system rules, approved business knowledge.
2. Tools: read-only catalog search, product lookup, comparison data,
   categories, policies/FAQs; plus three narrow record-keeping tools —
   record purchase interest, escalate a question, request a human (D26).
3. Conversation flow: greet, ask preferences, search, recommend, answer about
   specific items, compare, explain how buying works (from configured text).
4. Interest stages: inquiry, purchase request, reservation request. The agent
   never changes a product's status and never confirms a sale (D26).
5. Guardrails: product cards rendered from database records, product-ID
   verification, exact vs partial match, policies only from configured
   content, "I need to confirm that" instead of guessing, injection
   resistance, rate and length limits.
6. Owner notifications for scenarios A, B and C only (D27), by email at this
   stage; each links to the conversation.
7. Widget upgrade: conversation view, product cards with photo, price, size,
   condition, status, link; "talk to a person" at any time. The assistant
   says it is an AI.
8. Evaluation suite: match exists, several matches, no match, missing
   information, item becomes sold or pending mid-conversation, off-topic,
   injection attempts, purchase intent vs browsing, unanswerable question,
   human request, returning visitor with history.

Completion criteria:

- [x] Agent core, tools, guardrails, conversation history, chat panel with
  product cards (D32).
- [x] Guardrails proven with scripted models: no invented products shown,
  sold/on-hold never offered for purchase, notifications only for A, B, C
  with no duplicates, limits, safe fallback on failure.
- [x] With no provider or with the assistant switched off, the widget is the
  WhatsApp click-to-chat panel.
- [x] Evaluation against the real AI model: `npm run eval:agent`. First
  run by the owner: 70 of 71 checks passed (D34).
- [x] Re-run after the fixes: 75 of 75 checks passed on the third run (D34).
- [x] Skyra persona, name memory, Roman Urdu and Urdu (D35): 131 of 133
  checks on the sixth run; both misses were over-strict checks.
- Email delivery is deferred: the owner chose to wait for the admin inbox.
- [ ] Owner approval.

Known so far (D31): local pickup in Tampa, Florida; payment by Zelle, Cash
App or cash at pickup. The exact wording the agent may use is still to be
written with the owner.

Needed from the owner: AI provider account and key (or approval of a free
allowance to start); business policies (pickup arrangements, returns, how a
purchase is completed) — anything not provided is escalated, not guessed;
notification email address.

## Milestone 5 — Admin portal

Steps:

1. [x] Authentication: login, logout, change password, protected routes and APIs,
   one-time setup script for the first admin. No public registration.
   (Built in part 1; own implementation, D36.)
2. [x] Dashboard: product counts by status (draft, available, pending, sold),
   recent items, recent changes, open escalations. (Built in part 1.)
3. Product management: create, edit, draft, preview, publish, archive; all
   product details including fabric, pieces, stitching, occasion and
   imperfections; multi-photo upload with reordering.
   - Photo clean-up and listing pre-fill using free methods only (D23);
     start with a trial on real product photos before building.
4. Status changes (D25): available ⇄ pending, pending → sold, available →
   sold, sold → available (undo). Hold details (customer name, hold date,
   expected expiry, internal notes) visible only in admin. Nothing is
   permanently deleted; status history is kept. Automatic hold expiry
   (approved, D31): a hold ends after 72 hours and the item returns to
   available; the period is a setting; the owner can extend or end a hold.
5. Image storage: production storage implementation; file type, size and
   content validation.
6. Category management: add, rename, reorder, hide, and move categories
   between groups (D22).
7. Settings: branding, logo, byline, WhatsApp number, contact, social links,
   featured products, description, SEO, chat widget. Saving takes effect
   immediately, with no redeployment.
8. Conversation inbox: list conversations and leads; read history; reply as
   the owner; hand a conversation back to the agent; answer an escalated
   question so the agent can resume (D27).
9. AI management: enable/disable, greeting, behaviour instructions, handoff
   message, FAQs and policies, notification preferences.
10. Audit log of inventory, status and settings changes.
11. Security review and tests: access restrictions, upload validation, and
    that admin changes appear immediately on the public site and in the
    agent's answers.

Completion criteria: every item in the Milestone 5 verification list in the
owner's brief passes, plus status/hold behaviour and the inbox; owner approval.

Needed from the owner: admin email address; Supabase account (or agreed
alternative) for production database and images.

## Milestone 6 — AI sales agent on WhatsApp

The same agent from M4, connected to the official WhatsApp Business Platform
(Cloud API) directly, with no third-party agent service (D28).

Steps:

1. Meta setup with the owner: business portfolio, WhatsApp Business Account,
   dedicated phone number, display name, payment method, permanent access
   token. (Can start during M3–M5.)
2. Webhook endpoint: signature verification, fast acknowledgement, duplicate
   protection, message queue.
3. WhatsApp channel adapter: text, product photo messages with price, size,
   condition and link; reply buttons where useful.
4. Customer-service window handling: free-form replies only within 24 hours
   of the customer's last message; approved template messages for anything
   later (for example the owner's answer arriving the next day).
5. Human handoff on WhatsApp: agent pauses when the owner takes over in the
   inbox and resumes when handed back.
6. Owner notifications by WhatsApp as well as email, if wanted.
7. Opt-out handling ("stop"), privacy notice, message retention setting.
8. Click-to-chat links from M3 now open a conversation with the agent.
9. Tests with Meta's test number first, then the real number: all M4
   evaluation scenarios over WhatsApp, plus window expiry, duplicates,
   out-of-order messages and handoff.

Completion criteria: a customer can go from greeting to purchase request on
WhatsApp with accurate product details; scenarios A, B and C behave as
specified; nothing is sent outside Meta's rules; owner approval.

Needed from the owner: decisions and accounts listed in D28.

## Milestone 7 — Facebook and Instagram catalog sync

The website database stays the master. Products are pushed to one Meta
catalog that feeds both Facebook and Instagram (D29).

Steps:

1. Meta setup with the owner: Commerce Manager catalog, Facebook Page,
   Instagram professional account linked to the Page, domain verification.
2. Field mapping from our product to Meta's catalog fields; our product ID
   (`PLW-0001`) is the catalog item ID, which prevents duplicates.
3. Sync engine: every publish, edit, photo change and status change queues a
   sync job; a background worker sends it through Meta's official catalog
   API, retries failures with increasing delays, and records the result.
4. Status mapping: available → in stock; pending → out of stock; sold → out
   of stock, then removed after a configurable period; draft or archived →
   removed.
5. Safety net: a scheduled full comparison between our database and the
   catalog that repairs any drift.
6. Admin: per-product sync status (synced, waiting, failed with the reason,
   Meta review result where available), "retry" button, a channel overview
   page, and a master on/off switch.
7. Tests against a test catalog: create, update, sold, pending, back to
   available, archive, API failure and recovery, no duplicates.

Completion criteria: publishing a product creates exactly one catalog item;
edits and status changes arrive without manual work; failures are visible and
retryable; owner approval. Visibility inside Facebook and Instagram Shops is
subject to Meta's review and eligibility rules and is not guaranteed by the
sync itself (D29).

Needed from the owner: accounts listed in D29. No online checkout for now
(D31), so step 1 includes testing with Meta whether a Shop is accepted
without one; if not, the catalog is used without a Shop. Messages from
Facebook and Instagram go to the owner in Messenger / Instagram; no AI agent
there.

## Milestone 8 — End-to-end testing and production readiness

- Full journeys across website, website chat, WhatsApp, admin and Meta
  catalog, including an item going available → pending → sold everywhere.
- Hosting account, production database and storage, environment variables,
  custom domain, HTTPS, scheduled jobs, backups and a restore test.
- Security review, privacy policy and terms pages, cookie/consent notice where
  required, data retention settings.
- Monitoring and alerts for failed sync jobs, webhook errors and AI spend;
  spending caps.
- Performance and accessibility pass; real-device testing.
- Owner handover guide.

## Later (not scheduled)

Cart, online payments, customer accounts, orders, wishlist, discount codes,
social media integration, analytics, sales reporting, admin roles, purchase
history. Only on explicit request.
