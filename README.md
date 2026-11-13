# Pre-Loved Wardrobe

A boutique-style website for selling pre-owned Indian and Pakistani clothing.

## Run locally

Requires Node.js 20.19 or newer and a PostgreSQL 16 database.

1. Install packages:

   ```bash
   npm install
   ```

2. Start a database. With Docker installed:

   ```bash
   docker compose up -d
   ```

3. Create your settings file:

   ```bash
   cp .env.example .env.local
   ```

   To see the WhatsApp buttons and the floating chat button, set the shop's
   number in `.env.local` (digits only, with country code) before the next step:

   ```bash
   SEED_WHATSAPP_NUMBER=18139907900
   ```

   Without a number the site hides them. Run step 4 again after every
   `git pull` so database changes are applied.

   Optional: to turn the chat button into the AI assistant, also add an
   Anthropic API key to `.env.local`. Without it the button opens WhatsApp.

   ```bash
   ANTHROPIC_API_KEY=your-key-here
   ```

4. Create the tables and load sample products (this replaces any existing products):

   ```bash
   npm run db:seed
   ```

5. Start the site, then open http://localhost:3000:

   ```bash
   npm run dev
   ```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the site for development |
| `npm run build` then `npm run start` | Build and run the production version |
| `npm run db:migrate` | Apply database changes |
| `npm run db:seed` | Reset the database to the sample data |
| `npm run db:generate` | Create a migration after editing the schema |
| `npm run lint` / `npm run typecheck` | Code checks |
| `npm test` | Logic and database tests (uses the `wardrobe_test` database) |
| `npm run test:e2e` | Browser tests at desktop, tablet and phone sizes |

## Documentation

- [Project overview](docs/PROJECT.md)
- [Development plan](docs/DEVELOPMENT_PLAN.md)
- [Technical decisions](docs/TECHNICAL_DECISIONS.md)
- [Database schema](docs/DATABASE_SCHEMA.md)
- [Progress](docs/PROGRESS.md)
