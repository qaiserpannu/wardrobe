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

### Milestone 1 (2026-11-12) — approved

Stack selection, Next.js scaffold, folder structure, project memory documents.

## Outstanding — waiting on the owner

1. Review revision 2; list further changes or approve Milestone 2.
2. Categories: say whether they should be grouped (Women / Men / Kids) and
   give the preferred list (D22). Editing them without code comes with the
   admin portal in Milestone 5.
3. Confirm the occasion list (casual, formal, party, festive, wedding, bridal).
4. WhatsApp number: stays configurable; owner will supply it once Milestone 2
   issues are settled.
5. Still open from Milestone 1: hosting choice (D9); proposed services (D4,
   D6, D7, D8).

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

On approval, begin Milestone 3: floating chat widget using the existing
WhatsApp link builder, `chat_widget` settings, product-aware messages.
