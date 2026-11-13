# Progress

Update this file at the end of every working session.

## Current milestone

**Milestone 5 — Admin portal: all five parts built and tested. Awaiting
owner approval.** Do not start Milestone 6 until the owner approves.

| Part | What | State |
| --- | --- | --- |
| 1 | Secure sign-in, setup command, dashboard, account page | Built and tested |
| 2 | Items: add, edit, photos, status changes, holds with 72-hour expiry | Built and tested |
| 3 | Categories and settings | Built and tested |
| 4 | Inbox (conversations, requests, replies) and AI management | Built and tested |
| 5 | Activity page, security review, full verification | Built and tested |

Not built in Milestone 5, by decision (each is noted where it belongs):
photo clean-up and photo-based pre-fill (waiting for real photos, D23);
cloud image storage (waits for hosting, D6); a logo picture; alerts to the
owner when a customer is waiting; replying to WhatsApp chats from the inbox
(Milestone 6).

## Completed

### Milestone 5, part 5 (2026-11-13) — Activity page and security review (see D40)

- Activity page: the permanent record of every change, sign-in and
  automatic action, filterable by area. Entries cannot be edited or removed.
- Security review of the whole portal, with four fixes: a fairer lockout
  (a stranger can no longer lock the owner out with five wrong guesses);
  `npm run db:seed` refuses to wipe a database with real items; extra
  protective headers; `/robots.txt` keeping search engines out of admin.
- New tests that fail if a future admin page, action or API forgets its
  sign-in check, and a browser test that replays a real admin request
  without a session (refused).
- Tests: 152 logic/database tests (10 new); 15 new browser runs.
- NOT done: independent security testing; anything on real hosting.

### Milestone 5, part 4 (2026-11-13) — inbox and assistant management (see D39)

- Inbox: "Waiting for you" and "All conversations"; a count beside Inbox in
  the menu; the dashboard's waiting list links to each conversation.
- Conversation page: the full thread, what is waiting, items the customer
  asked about (linked to the item), reply box, "Hand back", "Mark as dealt
  with".
- Owner replies appear in the customer's website chat marked "From the shop
  owner", within about 10 seconds if the chat is open, otherwise when they
  next open it. While the owner is handling a conversation the assistant
  stays silent (no AI call); it returns when handed back, or by itself 24
  hours after the owner's last message.
- Fix found while testing: a buy request now also creates a "waiting" entry
  (before, it was recorded and notified but would not have been listed as
  waiting).
- Assistant page: status and today's usage, on/off, name, greeting, tone
  guidance, handoff message, daily message limit, and the shop information
  she may quote (add, edit, switch off, delete).
- No database change. No new dependency.
- Tests: 142 logic/database tests (13 new); 12 new browser runs with two
  browsers (customer and owner).
- NOT built: replying to WhatsApp conversations from the inbox (Milestone
  6); email or push alerts when someone is waiting (the owner must look at
  the inbox); notification preferences.
- NOT tested against the real AI model: nothing here changes what the model
  is told except the owner-written settings, but the evaluation
  (`npm run eval:agent`) has not been re-run since this part.

### Milestone 5, part 3 (2026-11-13) — categories and settings (see D38)

- Settings page: WhatsApp number and messages, shop name and header strip,
  homepage text and picture, contact details, social links, chat button,
  usual hold length, search-engine description. Each section saves on its
  own and the website changes immediately.
- A 10-digit US WhatsApp number gets the country code added; links get
  `https://` added; bad values are explained and what was typed is kept.
- Categories page: add groups and categories, rename (the web address stays
  the same), reorder, hide/show, move between groups. Nothing is deleted.
  Hiding a category takes its items off the website and away from the
  assistant.
- No database change. No new dependency.
- Tests: 129 logic/database tests (17 new); 9 new browser runs.
- NOT built: a logo picture (the header uses the shop name as text; no page
  shows a logo image yet); currency, language and time zone boxes (fixed at
  US dollars / US English / US Eastern); the assistant's settings (part 4).

### Milestone 5, part 2 (2026-11-13) — items, photos, status and holds (see D37)

- Items list in admin with status tabs, search and paging, including drafts
  and archived items.
- Add and edit an item with every detail; suggestions from values used
  before; a failed save keeps what was typed. New items start as drafts.
- Photos: upload several at once, reorder, remove; first photo is the cover.
  Files are checked by content, re-encoded, shrunk, and stripped of location
  data.
- Preview of any item as customers would see it.
- Status box: publish, put on hold (who, contact, private note, length),
  edit or extend a hold, end a hold, mark sold, undo a sale, archive,
  restore. Full history per item.
- Holds end by themselves after 72 hours (the `holds` setting) and the item
  becomes available again.
- Changes show on the website and to the assistant immediately.
- New tables (seventh migration): product_holds, product_status_events.
  `sharp` listed as a direct dependency.
- Tests: 112 logic/database tests (27 new); 12 new browser runs covering the
  whole life of an item at desktop, tablet and phone sizes.
- NOT built: photo clean-up and photo-based pre-fill (waiting for real
  photos to trial, D23); cloud image storage (waits for hosting).
- NOT tested: uploading from a real phone (HEIC conversion, camera photos).

### Milestone 5, part 1 (2026-11-13) — admin sign-in and dashboard (see D36)

- `/admin` is a separate area with its own frame; the shop header, footer
  and chat button are not part of it. Public pages moved into the `(site)`
  route group; addresses did not change.
- Sign-in with email and password. No sign-up page exists. The account is
  created only by `npm run admin:create`, which asks for the details in the
  terminal (password hidden) and also resets a forgotten password.
- Passwords stored as salted scrypt hashes; sessions are random values held
  in an httpOnly, same-site cookie with only a fingerprint in the database;
  7 days idle / 30 days maximum; lockout after 5 wrong passwords per email
  or 20 per address in 15 minutes.
- Dashboard: counts by status, customer requests waiting, recently changed
  items, recent activity. Account page: change password (signs out other
  browsers).
- New tables (sixth migration): admin_users, admin_sessions, login_attempts,
  audit_log. No new dependency.
- Tests: 85 logic/database tests (16 new); 21 new browser runs for the admin
  area across desktop, tablet and phone.
- NOT tested: typing the password into the setup command on Windows (tested
  on Linux, in a real terminal and with piped answers).

### Milestone 4 (2026-11-13) — AI sales agent, website chat (see D32)

- The chat button now opens a conversation with an AI assistant when an AI
  key is configured; otherwise it is the WhatsApp panel from Milestone 3.
- Agent core, six tools (three read inventory, three record interest /
  questions / human requests), approved shop information, conversation
  history per visitor, product cards from live records, owner notifications
  for scenarios A, B and C only.
- Safeguards enforced in code: invented product IDs are never shown; sold and
  on-hold items cannot be requested; no tool can change stock; message, rate
  and daily limits; safe fallback with the WhatsApp route on any failure.
- New tables (fifth migration): customers, conversations, messages, leads,
  escalations, notifications, ai_knowledge.
- New dependency: `@anthropic-ai/sdk` (the official library for the AI).
- Tests: 68 logic/database tests (20 new for the agent); 164 browser runs
  passed across desktop, tablet and phone (7 size-specific skips); lint,
  type-check, build; visual check of both panels at desktop and phone sizes.
- NOT tested: the real AI model's behaviour; sending notification emails.
- Owner decisions (D33): cheapest model (Claude Haiku 5.5 is now the
  default); all sales final, no returns (added to the approved shop
  information); notifications wait for the admin inbox.
- Persona change at the owner's request (D35): the assistant is Skyra,
  greets with salam, asks and remembers the name, asks what the customer is
  looking for, and replies in English, Roman Urdu or Urdu. Not yet run
  against the real model.
- First real-model evaluation (owner's computer, Haiku 5.5): 70 of 71
  checks passed; about one cent for the run; wording fixes made (D34).
- Added `npm run eval:agent`: 17 conversations, 71 checks, against the real
  model. The cloud environment cannot use the owner's key, so it has not
  been run for real.

### Milestone 3 (2026-11-12) — floating WhatsApp chat button

- Round WhatsApp button in the bottom corner of every public page. It opens a
  small panel with a greeting and a "Start chat on WhatsApp" button (official
  click-to-chat link, opens in a new tab or the app).
- On the page of an available item the message names the item, its ID and
  its link. On sold and on-hold items, and everywhere else, it is the general
  greeting.
- Closes with its X, the round button, the Escape key or a click elsewhere;
  keyboard focus moves in and back out.
- New `chat_widget` settings: on/off, title, greeting, left or right corner.
  The button disappears if switched off or if no WhatsApp number is set.
- Tests: 48 logic/database tests; 125 browser runs passed across desktop,
  tablet and phone (7 size-specific skips); lint, type-check and build pass;
  visual check at desktop and phone sizes.
- Not verified here: that WhatsApp itself opens a conversation (needs a real
  phone or WhatsApp account).

### Milestone 2 (2026-11-12)

- Database: tables for categories, products, product images and site settings;
  first migration; sample data of 28 products across 8 categories (22
  available, 3 sold, 2 drafts, 1 archived) with generated placeholder pictures.
- Services layer: catalog listing with search, filters, sorting and paging;
  product lookup; featured, recent and related items; filter options;
  categories; settings.
- Design system: colours and fonts as theme tokens, buttons, icons, badges.
- Layout: sticky header with navigation and search, mobile menu, footer with
  categories, contact and social links from settings.
- Homepage: hero, featured pieces, browse by category, recently added, how it
  works, calls to action.
- Catalog (`/shop`): keyword search; filters for category, size, brand,
  condition, price and hiding sold items; sort by newest and price; paging;
  removable filter chips; everything kept in the URL.
- Product page: photo gallery, details, availability, WhatsApp inquiry with
  product name, ID and link; sold notice; related items; search-engine and
  link-preview data.
- Not-found and error pages; basic security headers.
- WhatsApp link builder (needed for the product page; the floating widget is
  Milestone 3).
- Tests: 40 logic and database tests; 26 browser scenarios run at desktop,
  tablet and phone sizes (71 runs passed, 7 intentionally skipped as
  size-specific), including a crawl of every internal link and image.

### Fixes after Milestone 2 (2026-11-12)

- Homepage showed a "Blocking Route" error (random value while prerendering)
  and a "URL data" warning when run with `npm run dev`. Both fixed (D14
  update); all checks and browser tests re-run and passing.
- The same "Blocking Route" error then appeared on `/shop`. The shop page and
  product page now use the same fix; checks and browser tests re-run and
  passing.

### Milestone 2 revision 1 (2026-11-12) — Indian and Pakistani clothing theme

Owner feedback: the shop is for Indian and Pakistani clothes, so the theme and
design must reflect that.

- New look: ivory, deep maroon and antique gold; arch-shaped hero image and
  category tiles; gold lattice texture; ornamental dividers; maroon footer
  with scalloped gold edge; announcement strip above the header.
- Categories and sample inventory replaced (shalwar kameez, kurtas, lehengas,
  sarees, anarkalis, menswear, dupattas, accessories) with matching placeholder
  illustrations and South Asian brands.
- Site copy updated (tagline, hero, descriptions).
- Stored image names now include a content fingerprint (D19); this fixed
  stale pictures appearing after artwork changed.
- Fixed: clicking a link on a missing-product page logged a browser error
  (the next page still loaded). Found as an intermittent test failure; the
  missing-product message is now rendered without throwing (D14).
- All tests updated and passing: 40 logic/database tests, 71 browser runs;
  the previously intermittent test was repeated 36 times without failure.

### Milestone 2 revision 2 (2026-11-12) — extra details, imperfections, logo

Owner feedback after the redesign:

- Currency confirmed: USD.
- Products now have fabric, pieces, stitched/unstitched, occasion and an
  imperfections note (D20): shown on the product page, with four new catalog
  filters; fabric is searchable. Second database migration.
- Product page has an "Imperfections" section, always shown.
- Logo shows "By Skyra" under the site name (`branding.byline` setting), in
  the header and footer.
- Recorded for Milestone 5: photo-assisted listing and photo enhancement
  (D21), owner-managed categories with possible grouping (D22).
- Tests: 42 logic/database tests, 77 browser runs, all passing.

### Milestone 2 revision 3 (2026-11-12) — category groups

- Categories are grouped (D22): Women, Men, Kids, Accessories, each with
  categories inside. Third database migration (`parent_id`).
- Desktop menu has drop-downs per group; phone menu lists groups with their
  categories; homepage shows four group tiles with category links beneath;
  filters, breadcrumbs and footer follow the groups.
- Sample data regrouped; two kids' items added (30 products: 24 available,
  3 sold, 2 drafts, 1 archived).
- Owner chose the free route for photo clean-up and pre-fill (D23); to be
  trialled and built in Milestone 5.
- Occasion list confirmed.
- Tests: 44 logic/database tests, 80 browser runs, all passing.

### Roadmap revision (2026-11-12) — documentation only, nothing built

Owner added requirements; plans and architecture updated, no code changed.

- Roadmap now has 8 milestones (order from M6 proposed, awaiting approval).
- New decisions: D24 one agent for web and WhatsApp; D25 statuses including
  PENDING and admin-only hold details; D26 what the agent may do; D27 owner
  notifications and handoff; D28 WhatsApp Cloud API with our own agent; D29
  Facebook/Instagram catalog sync; D30 background jobs.
- Planned tables documented in `DATABASE_SCHEMA.md`.
- Research limits: Meta's official documentation pages could not be opened
  from the development environment (network rules), so D28 and D29 rest on
  search results and secondary sources and are marked "verify".
- Category groups confirmed by the owner.

### Milestone 2 revision 4 (2026-11-12) — ON HOLD status and owner decisions

- New `pending` status (fourth migration). Public site: "On hold" badge on
  cards and the product page, a notice instead of the WhatsApp button, listed
  after available and before sold items, "Hide sold and on-hold items"
  filter, out-of-stock in search-engine data. Two sample items on hold
  (32 products: 24 available, 2 on hold, 3 sold, 2 drafts, 1 archived).
- Owner decisions recorded in D31: milestone order approved; US only, local
  to Tampa FL with pickup; payment by Zelle, Cash App or cash; no online
  checkout for now; Facebook/Instagram messages handled by the owner, no AI
  there; holds expire after 72 hours (built in M5); WhatsApp number
  +1 813 990 7900.
- The WhatsApp number is in the local sample data; the product page button
  now opens a chat with that number (link checked, a real conversation still
  to be confirmed by the owner on a phone).
- Tests: 46 logic/database tests, 86 browser runs passed (7 size-specific
  skips); lint, type-check and build pass; visual check at desktop and phone
  sizes.

### Milestone 1 (2026-11-12) — approved

Stack selection, Next.js scaffold, folder structure, project memory documents.

## Outstanding — waiting on the owner

1. Approval of Milestone 5. A few real product photos, to trial photo clean-up (D23).
2. Milestone 6: use +1 813 990 7900 for the AI agent, or a new dedicated
   number (D28, D31).
3. Later: Meta accounts, domain, hosting choice (D9), proposed services
   (D4, D6, D7).

## Known issues and limitations

- Product pictures and the hero image are generated placeholders, not
  photographs.
- The WhatsApp number comes from `SEED_WHATSAPP_NUMBER` in `.env.local`
  (not committed); a fresh environment must set it to `18139907900` before
  seeding, otherwise the product page shows a "quote this product ID" note.
  Tests use a fictional number.
- A non-existent product address shows the not-found page with response code
  200 plus "noindex" instead of 404 (see D14).
- Settings and category names can take up to a minute to update after a direct
  database change, and up to 5 minutes for a visitor who keeps browsing without
  reloading (D14). Product data is immediate.
- Website visitors are anonymous: unless they give a phone number in the
  chat or use the WhatsApp button, the owner cannot reply to an escalated
  question. The agent is instructed to ask or point to WhatsApp.
- The owner is not alerted when a customer is waiting; the inbox and
  dashboard must be checked (email needs a sending service; WhatsApp alerts
  come with Milestone 6).
- Only local image storage exists (photos are files in the `storage`
  folder); cloud storage is added at deployment.
- `docker-compose.yml` is provided for local setup but was not run in the
  cloud development environment (no Docker there); the database was tested
  with a directly installed PostgreSQL 16.
- Not yet deployed anywhere; verified locally only. Real-device testing happens
  once a preview deployment exists.
- `npm audit` reports moderate advisories in development tooling only.

## Next steps

1. On Milestone 5 approval: Milestone 6 (AI agent on WhatsApp), which
   needs the owner's Meta/WhatsApp Business setup (D28) before it can start.
