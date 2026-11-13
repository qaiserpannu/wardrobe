# Pre-Loved Wardrobe — instructions for Claude

A boutique-style website for selling pre-owned Indian and Pakistani clothing. Buyers inquire via
WhatsApp; there is no online checkout.

@AGENTS.md

## Start of every session

1. Read `docs/PROGRESS.md` to see the current milestone and what is outstanding.
2. Read `docs/DEVELOPMENT_PLAN.md` for the steps of that milestone.
3. Consult `docs/PROJECT.md`, `docs/TECHNICAL_DECISIONS.md` and
   `docs/DATABASE_SCHEMA.md` as needed.

## Working rules

- **Roadmap has 8 milestones** (revised 2026-11-12); see
  `docs/DEVELOPMENT_PLAN.md`.
- **One milestone at a time.** Never start the next milestone without the
  owner's explicit approval. Do not build ahead.
- **Tested means tested.** Do not report something as working unless it was
  actually run. A milestone needs lint, type-check, build and tests passing,
  plus a real browser check at desktop and mobile sizes.
- **Ask before major architecture changes.** Record the outcome in
  `docs/TECHNICAL_DECISIONS.md`.
- **The owner is not a developer.** Explain decisions in plain language.
- **No new dependency without a reason.** Install packages in the milestone
  that first uses them.
- The shop is local to Tampa, Florida (US): pickup in person; payment by
  Zelle, Cash App or cash. No online checkout. Facebook and Instagram
  messages are answered by the owner, not the AI agent (D31).
- Develop on the `develop` branch. No pull requests unless asked.

## Architecture rules

- Only `src/server/services` talks to the database. Pages, API routes and AI
  tools call services.
- Public service functions return only publicly visible products (`available`,
  `pending` and `sold`, in an active category) and only public fields (`PublicProduct`). Drafts and archived items never leave
  admin code paths.
- Anything under `src/server` is server-only. Never import it into a client
  component. Secrets come from environment variables and never reach the
  browser.
- Site content that the owner may want to change (WhatsApp number, contact
  details, branding, social links, homepage text, AI messages) is read from
  site settings, not hardcoded.
- WhatsApp links are built only by `src/integrations/whatsapp`.
- The floating chat button (`src/components/chat`) is in the root layout. A
  page tells it about a product by rendering `ChatProductContext`; do this
  only for items that can be bought (`available`).
- Validate all external input (forms, query strings, API bodies, uploads) on
  the server.
- Every admin page, Server Action and admin API calls `requireAdmin()`
  (`src/server/auth/session.ts`) itself; a layout or `src/proxy.ts` is not
  enough. Admin pages read the session inside `<Suspense>`.
- There is no sign-up route. Admin accounts come only from
  `npm run admin:create` (D36). Never add credentials to code, seed data or
  environment files.
- Admin-only services are named `admin-*.ts`; never import them from public
  pages, the chat API or the agent.
- Public pages live in `src/app/(site)`; the admin portal in `src/app/admin`.
- Record every admin change with `recordAudit` (no secrets in it).

## AI agent rules (Milestone 4 onward)

- One agent core serves every channel (website chat, WhatsApp). Channel code
  lives in adapters; never put channel-specific logic in the core (D24).
- Inventory and settings are read-only for the agent. Its only writes are
  conversation records through four narrow tools: save the customer's name,
  record purchase interest, escalate a question, request a human. It never changes a product's status
  and never confirms a sale or a hold (D26).
- Product facts shown to customers come from tool results, not from model
  text. Product cards are rendered by our code from database records.
- Never state availability, prices, discounts, delivery, returns, payment
  methods or policies that are not in the database. If unsure, say it needs
  to confirm and escalate.
- Only `available` items are offered. `pending` and `sold` are described as
  such if asked. Hold details and internal notes are never reachable by
  public or agent code paths (D25).
- Notify the owner only for: serious buying interest, a question the agent
  cannot answer, or a request for a human (D27).
- The agent is "Skyra". It does not announce that it is an AI, but it never
  claims to be a person or the owner, tells the truth when sincerely asked,
  and the chat panel carries a small disclosure line (D35). It always
  offers a human handoff. It replies in the customer's language (English,
  Roman Urdu, Urdu).
- All model calls go through the provider interface
  (`src/server/agent/providers`). The core never imports a vendor SDK.
- Rules the business depends on are enforced in code (`core.ts`,
  `tools.ts`), not only in the instructions; see D32. Add a test in
  `tests/integration/agent.test.ts` for every new guardrail.
- `AI_PROVIDER=test` is a fixed-rule stand-in for browser tests only.
- WhatsApp: official Cloud API only; never unofficial automation libraries.
  Respect the 24-hour reply window and template rules (D28).

## Integration rules (Milestone 7 onward)

- The website database is the master for inventory. Meta's catalog is a
  destination; never read inventory back from it.
- Every product change that matters to a channel queues a sync job in the
  same database transaction. Use the product code as the external item ID.

## Coding standards

- TypeScript strict mode; no `any` without a comment explaining why.
- Server components by default; add `"use client"` only where interaction
  needs it.
- Components: one per file, PascalCase file names. Other files: kebab-case.
- Import with the `@/` alias (maps to `src/`).
- Prices are integers in the smallest currency unit; format only at display.
- Keep components small and reusable; shared pieces go in `src/components/ui`.
- Accessible markup: semantic elements, labels, alt text, keyboard support.
- Design: use the theme tokens in `src/app/globals.css` (maroon `accent`,
  `gold` for decoration only, never for text on light backgrounds) and the
  shared `Ornament`, `.pattern-jali` and `.edge-scallop` pieces. See D17.
- Stored image names must include a content fingerprint (D19).

## Commands

- `npm run dev` — start the development server at http://localhost:3000
- `npm run lint` — code style checks
- `npm run typecheck` — regenerate route types, then TypeScript checks
- `npm run build` — production build (needs `DATABASE_URL`; settings are read at build time)
- `npm run db:seed` — migrate and reset the database to sample data
- `npm run admin:create` — create the administrator, or reset the password (interactive)
- `npm run db:generate` — create a migration after changing `src/server/db/schema.ts`
- `npm test` — Vitest unit and database tests against `wardrobe_test`
- `npm run test:e2e` — Playwright; seeds the test database, builds, serves on port 3100

In a fresh cloud session PostgreSQL may be stopped: `pg_ctlcluster 16 main start`.
The `wardrobe` role and the `wardrobe` / `wardrobe_test` databases may need
creating again (see `docker-compose.yml` for names), then `npm run db:seed`.

## Data freshness and caching

- Product data is never cached. Product components fetch at request time
  inside `<Suspense>`, so availability is always current.
- Every component or `generateMetadata` that reads uncached data must call
  `await io()` (from `next/cache`) before its first query, even if it already
  awaits `params` or `searchParams`. Keep `stale` at 300 or more in
  `cached.ts` (see D14).
- Settings and the category list are cached for about a minute via
  `src/server/services/cached.ts` (tags `settings`, `categories`). Admin saves
  in Milestone 5 must call `updateTag` for these so edits appear immediately.
- Run the automated tests before reporting work as done. Browser tests must
  wait for streamed content before interacting (see `openFilters` in
  `tests/e2e/site.spec.ts`).

## Maintaining project memory

Update these in the same commit as the change they describe:

| File | Update when |
| --- | --- |
| `docs/PROGRESS.md` | End of every session: done, outstanding, known issues, next steps |
| `docs/TECHNICAL_DECISIONS.md` | A technology or architecture decision is made or changed |
| `docs/DATABASE_SCHEMA.md` | Any table or column changes |
| `docs/DEVELOPMENT_PLAN.md` | Milestone scope or order changes; criteria ticked off |
| `docs/PROJECT.md` | Requirements, scope, stack or structure change |
| `CLAUDE.md` | A new rule or convention is agreed |
