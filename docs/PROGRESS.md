# Progress

Update this file at the end of every working session.

## Current milestone

**Milestone 2 — Public website: built and tested, awaiting owner approval.**
Do not start Milestone 3 until the owner approves.

## Completed

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

### Milestone 1 (2026-11-12) — approved

Stack selection, Next.js scaffold, folder structure, project memory documents.

## Outstanding — waiting on the owner

1. Go-ahead to add the PENDING status to the data model and public website
   as the next piece of Milestone 2 work (D25), then Milestone 2 approval.
2. Approve or change the proposed milestone order (WhatsApp agent as its own
   milestone after the admin portal).
3. Confirm what "recommendations 1 and 2" referred to (read as: both free
   pre-fill options in D23).
4. Country the business operates from (decides Meta Shop availability and
   WhatsApp message rates).
5. WhatsApp: new dedicated number for the AI agent, or try to keep the
   existing number (D28). Number for click-to-chat in Milestone 3.
6. Whether to consider adding an online checkout if Meta requires one for a
   Shop (D29).
7. Whether automatic hold expiry is wanted (D25).
8. Later: Meta business portfolio, Facebook Page, Instagram professional
   account, Commerce Manager, domain; AI provider account; notification
   email; hosting choice (D9); proposed services (D4, D6, D7, D8).

## Known issues and limitations

- Product pictures and the hero image are generated placeholders, not
  photographs.
- No WhatsApp number is set in the development data, so the product page shows
  a "quote this product ID" note instead of the button. Tests use a fictional
  number to verify the button and message.
- Products and settings can only be changed by editing the sample data or the
  database until the admin portal (Milestone 5).
- A non-existent product address shows the not-found page with response code
  200 plus "noindex" instead of 404 (see D14).
- Settings and category names can take up to a minute to update after a direct
  database change, and up to 5 minutes for a visitor who keeps browsing without
  reloading (D14). Product data is immediate.
- Only local image storage exists; cloud storage arrives with Milestone 5.
- `docker-compose.yml` is provided for local setup but was not run in the
  cloud development environment (no Docker there); the database was tested
  with a directly installed PostgreSQL 16.
- Not yet deployed anywhere; verified locally only. Real-device testing happens
  once a preview deployment exists.
- `npm audit` reports moderate advisories in development tooling only.

## Next steps

1. With the owner's go-ahead: add PENDING to the status list, show it on the
   website (badge, ordering, no buy prompt), update tests — closes Milestone 2.
2. On Milestone 2 approval: Milestone 3, the click-to-chat widget.
