# Owner's guide

A short guide to running Pre-Loved Wardrobe once it is online. No technical
knowledge needed.

## Where things live

| What | Where | Sign in with |
| --- | --- | --- |
| The shop customers see | https://preloved-wardrobe.com | nothing |
| Your admin portal | the shop address followed by `/admin` | your admin email and password |
| The website itself (hosting) | netlify.com, project `preownerwardrobe` | your GitHub login |
| Items, conversations, photos | supabase.com, your project | your Supabase login |
| The AI assistant's account and bill | console.anthropic.com | your Anthropic login |
| The website's code | github.com, repository `wardrobe`, branch `develop` | your GitHub login |
| Backups | the `backups` folder inside the project folder on your computer | nothing |

## Everyday jobs (all in the admin portal)

- **Add or edit an item:** Items, then "Add item" or click an item. Photos
  can be taken straight from your phone.
- **Put an item on hold / mark it sold:** open the item and use the status
  panel. Holds end by themselves after the time set in Settings.
- **List an item on Facebook Marketplace or Instagram:** open the item and
  use the Share box. On a phone, "Share…" opens the share menu with the
  photos and words; on a computer, use "Copy the words" and "Download
  photos". You post it yourself in that app. When the item sells, mark it
  sold there too.
- **Answer a customer Skyra passed to you:** Inbox. The number on the menu
  shows how many are waiting.
- **Change the WhatsApp number, contact details, homepage text, chat button
  corner:** Settings.
- **Change what Skyra knows or says (FAQs, policies, greeting):** Assistant.
- **See who changed what:** Activity.
- **See how many people visit:** Visitors. It shows visitors, pages viewed
  and WhatsApp taps for today and the last 7, 30 or 90 days, the most viewed
  items, where visits came from (Facebook, Instagram, Google, or a shared
  link) and roughly where visitors are. Your own visits while signed in are
  not counted. Each item's page also shows its own count.

Changes show on the shop straight away. You never need to "publish".

## Once a week: back up

On your computer, in the project folder:

1. `npm run backup` saves everything, photos included, into `backups`.
2. `npm run backup:check` proves that backup can be restored. It needs
   Docker Desktop running.
3. Now and then, copy the `backups` folder to a USB stick or another
   private place. Keep it private: it contains customer conversations.

Also back up after any day you add a lot of items.

## Things that cost money, and how they are capped

- **Netlify and Supabase:** free plans. If a limit is reached they pause or
  slow the site; they do not charge you unless you choose to upgrade.
- **The AI assistant:** pay-as-you-go. Two caps protect you:
  1. In the Anthropic console, a monthly spending limit (set by you).
  2. In the admin portal under Assistant, "Most customer messages answered
     per day". When it is reached, the chat button opens WhatsApp instead.

## Things to know about the free plans

- **Supabase pauses a free project that nobody has used for about a week.**
  Visits to the shop count as use. If the shop ever shows errors after a
  quiet spell, sign in to Supabase and press "Restore project".
- **Netlify shows a small "Powered by Netlify" badge** on the free plan. The
  chat button sits above it on purpose.

## If something goes wrong

| What you see | What to do |
| --- | --- |
| The shop shows "We hit a snag" | Open the shop address followed by `/api/health`. If it says `"ok":false`, the database is unreachable: check Supabase (is the project paused?). |
| The whole site does not open | Check netlify.com: is the latest deploy "Published"? If the latest one says "Failed", the previous version stays online; tell your developer. |
| Photos are missing | Check Supabase: Storage, bucket `media`. Tell your developer; photos can be restored from a backup. |
| You forgot the admin password | On your computer run `npm run admin:create` and follow the prompts; it resets the password. |
| "Too many attempts" at sign-in | Wait 15 minutes, or run `npm run admin:create`, which also clears the lock. |
| Skyra stopped answering | Check the Anthropic console (credit and spending limit) and the daily limit under Assistant. The WhatsApp button keeps working meanwhile. |
| Something was deleted or damaged badly | Do not panic and do not run anything yet. Your last backup can be restored into a fresh database with `npm run backup:restore`; ask your developer to walk you through it. |

## How updates to the website work

When your developer changes the website, the new version goes online by
itself within a few minutes. You do not need to do anything, and your items
and settings are not affected. To get the same version on your own computer,
run `git pull` in the project folder.

## Secrets: never share these

Your admin password, the Supabase database password and secret key, and the
Anthropic key. Nobody, including your developer or the AI assistant, needs
you to paste them into a chat or an email. They live only in Netlify's
settings and in the `.env.local` file on your computer.
