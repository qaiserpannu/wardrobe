# Moving the shop from Netlify to Vercel (free)

Why: Netlify's free plan ran out of credits and paused the whole site (D49).
Your database (Supabase), photos and domain stay exactly where they are.
Do the steps in order. Nothing here costs money. Do NOT paste any key or
password into a chat; copy it directly from one website to the other.

## 1. Collect your settings from Netlify (before you leave it)

Netlify is paused but its settings page still opens: **Project configuration
> Environment variables**. Keep that tab open. You will copy these names and
values into Vercel in step 3 (only the ones that exist in Netlify):

| Name | What it is |
| --- | --- |
| `DATABASE_URL` | Supabase database address, the **Transaction pooler** (port 6543) one |
| `NEXT_PUBLIC_SITE_URL` | `https://preloved-wardrobe.com` |
| `STORAGE_DRIVER`, `SUPABASE_URL`, `SUPABASE_STORAGE_BUCKET`, `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) | where photos are kept |
| `AI_PROVIDER`, `AI_MODEL`, `ANTHROPIC_API_KEY` | the chat assistant |
| `RESEND_API_KEY`, `NOTIFY_EMAIL_FROM` | only if you set up email alerts |
| `VISIT_SALT` | optional; any random text; makes visitor counts harder to reverse |

If a value is hidden in Netlify, click to reveal it, copy it, and paste it in
Vercel. If you can no longer see one, you can create a new key in Supabase or
Anthropic and use that.

## 2. Create the Vercel project

1. Go to vercel.com and choose **Sign up > Continue with GitHub**. Choose the
   **Hobby** plan (free, personal use).
2. **Add New > Project**, find `wardrobe`, **Import**. If it is not listed,
   choose **Adjust GitHub App Permissions** and allow that repository.
3. Framework: it should say **Next.js**. Leave build settings as they are.

## 3. Settings before the first deploy

On the same screen, open **Environment Variables** and add each one from step 1
(name on the left, value on the right). Then press **Deploy**.

## 4. Make `develop` the live branch

Your work goes to the `develop` branch, but Vercel treats `main` as the live
one. After the first deploy: project **Settings > Environments > Production >
Branch Tracking**, type `develop`, **Save**. Then **Deployments**, find the
newest `develop` deployment, and **Promote to Production** if it is not already
production. (If you cannot find the setting, tell me what the screen shows.)

## 5. Check it before moving the domain

Open the address Vercel gives you (`something.vercel.app`) and check the shop,
an item page, the admin sign-in, uploading a photo, and the chat. Tell me if
anything is wrong. The photo upload and the chat in particular should be
tried.

## 6. Move the domain

1. In Vercel: project **Settings > Domains > Add** `preloved-wardrobe.com`.
   Vercel shows the exact records to create. Also add `www.preloved-wardrobe.com`
   and choose to redirect it to the main one.
2. In Cloudflare, **DNS > Records**: delete the two old records (`@` and `www`
   pointing at `preownerwardrobe.netlify.app`) and add the ones Vercel shows.
   Keep them **DNS only** (grey cloud).
3. Wait a few minutes. Vercel shows a green tick when it is ready and issues
   the padlock certificate by itself.
4. Open https://preloved-wardrobe.com and check again.

## 7. Afterwards

- The visitor counts need no extra step; city names appear once real visitors
  arrive.
- In Netlify you can delete the project, or just leave it paused.
- Vercel builds every push to `develop` automatically, for free (its limit is
  100 deploys a day). Tell me if you want that changed.
