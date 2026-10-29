# Saffra

Food costing and profit planner for small food businesses: coffee shops, milk tea shops, silog stalls, bakeries and more.
Owners enter what they buy and what goes into each product, and Saffra shows the real cost per order, a suggested selling price,
and the profit per day, month and year.

*Saffra* is named after saffron, the most valuable spice in the world: a small ingredient with real value. Brand files (logo, icon, app icon) are in [`brand/`](brand).

## Features

- **Accounts with cloud saving**: email and password sign-in through Supabase. Data saves to the account automatically, so clearing the browser or changing phones does not lose anything. Users stay signed in until they sign out.
- **Quick setup** on first sign-in, with starter templates (coffee shop, milk tea, silog, bakery).
- **Products** with ingredients and packaging, **sizes** (12 oz / 16 oz / 22 oz), **add-ons** (extra shot, extra egg) and **duplicate**.
- **Ingredient prices list**: each item is saved once and shared by every product; **usable %** for waste; **sub-recipes** for batches (garlic rice, dough, sauces); price history and **price alerts** that show the effect on monthly profit.
- **Pricing**: target margin or fixed price, competitor comparison, food cost %, **price rounding**, VAT on or off, **delivery app price** that keeps the same profit after commission.
- **Monthly expenses**, **sales plan**, **combos and upsell simulator**, **daily sales log** (plan vs actual), **profit report** with break-even and a **monthly profit goal**.
- **Export**: Excel workbook, PDF report and JSON backup/restore (also restores backups from the HTML preview version).
- English / Taglish, Light / Dark / Auto, works on phones, tablets and computers. Undo after deleting.

## Tech stack

- Next.js 15 (App Router) + TypeScript + React 19
- Supabase: Auth and Postgres with Row Level Security
- Plain CSS (`src/app/globals.css`), the same design as the HTML preview
- `immer` for state updates, `exceljs` and `jspdf` for exports (loaded only when a user exports)
- Deploys on Vercel, with Vercel Web Analytics for anonymous, cookie-free visit counts (turn it on in the Vercel project under **Analytics → Enable**)

## How data is stored

Each account owns one row in `public.businesses`. The whole business (products, ingredients, logs, settings) is a JSON document in the `data` column.

- Row Level Security allows a signed-in user to read and write **only their own row**.
- Every save sends `version + 1` and only succeeds if the row is still at `version`. If another device saved first, the app loads the newest copy instead of overwriting it, and tells the user.
- A copy is cached in the browser for a fast start. Unsaved changes made while offline are kept on the device and saved when the connection returns.

If the Supabase environment variables are missing, the app runs in **local mode**: no sign-in, data saved in that browser only. This is handy for local development.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com). Choose the **Southeast Asia (Singapore)** region, the closest to the Philippines.
2. Open **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and run it.
3. Open **Authentication → URL Configuration**:
   - **Site URL**: your app address, for example `https://saffra.vercel.app` (use `http://localhost:3000` while developing).
   - **Redirect URLs**: add `http://localhost:3000/auth/callback` and `https://YOUR-DOMAIN/auth/callback`.
4. Open **Authentication → Sign In / Providers → Email**. "Confirm email" is on by default, which means new users must click the link in their email before signing in. Keep it on for production.
5. Open **Project Settings → API** and copy the **Project URL** and the **anon public** key.

> The default Supabase email sender is rate limited and meant for testing. Before inviting many users, set up a custom SMTP provider under **Authentication → Emails → SMTP Settings**.

### 2. Run locally

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local   # then fill in the three values
npm run dev
```

Open http://localhost:3000. You will be sent to the sign-in page.

### 3. Deploy to Vercel

1. Push this project to GitHub.
2. In Vercel, **Add New → Project** and import the repository. The framework is detected as Next.js.
3. Add the environment variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SITE_URL` (your Vercel address).
4. Deploy. Then put the final address in Supabase **Site URL** and **Redirect URLs** (step 1.3).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run typecheck` | TypeScript check |

## Project structure

```
src/
  app/
    (auth)/            login, signup, forgot-password, reset-password
    (app)/             dashboard, welcome, products, products/[id], ingredients, expenses,
                       sales, report, daily, combos, export, guide, business
    auth/callback/     handles links from confirmation and reset emails
    (legal)/           privacy policy and terms of use (public pages)
    globals.css        all styles
  components/          Shell (sidebar and mobile menu), shared UI, one file per screen in views/
  lib/                 calc.ts (all math), data.ts (templates, sample data, sizes), exporters.ts, supabase/
  store/store.ts       app state, auto-save, version check, undo
  middleware.ts        keeps the session fresh and protects pages
supabase/schema.sql    table, trigger and Row Level Security policies
```

## Security notes

- Only the Supabase **anon** key is used in the app. Never put the `service_role` key in this project or in Vercel environment variables that start with `NEXT_PUBLIC_`.
- Row Level Security is required. Without it any signed-in user could read other businesses. The schema turns it on.
- Security headers (HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`) are set in `next.config.ts`.
- Business and personal data falls under the Philippine Data Privacy Act of 2012 (RA 10173). The Privacy Policy (`/privacy`) and Terms of Use (`/terms`) live in `src/app/(legal)/`; the operator name, contact email and effective date are in `src/app/(legal)/legal.ts`. Have them reviewed by a lawyer before charging for the app, and update them whenever the app starts collecting something new (payments, analytics).

## Next phase

- Sign in with Google
- AI receipt scan (needs a server-side AI API key in a Next.js route handler)
- Installable app and full offline mode (PWA)
- Delete account from inside the app, and data export on request
- Paid plan
