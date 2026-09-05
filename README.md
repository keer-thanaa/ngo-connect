# NGO Connect — Cycle Zero #1

A community noticeboard connecting care institutions (orphanages, old age
homes) to NGOs. Institutions post what they need; approved NGOs browse and
claim it. Every account is manually reviewed before it goes live.

---

## 1. Set up Supabase (free tier is enough)

1. Go to https://supabase.com → create a free project.
2. Once it's ready, open **SQL Editor** → New query → paste the entire
   contents of `sql/schema.sql` → **Run**. This creates the two tables,
   turns on Row Level Security, and adds the `claim_requirement()` function
   NGOs use to claim a need safely.
3. Go to **Project Settings → API**. Copy your **Project URL** and the
   **anon public key**.
4. Open `js/supabaseClient.js` and paste them in:
   ```js
   const SUPABASE_URL = 'https://xxxxx.supabase.co';
   const SUPABASE_ANON_KEY = 'eyJ...';
   ```
5. Go to **Authentication → Providers** and confirm **Email** is enabled
   (it is by default). Optionally turn off "Confirm email" while testing,
   so you don't need to click a confirmation link for every test account.

That's your entire backend — no server to run.

## 2. Run it locally

Any static file server works, e.g.:
```bash
npx serve .
```
Then open the printed local URL.

## 3. Approve accounts (manual review step)

When someone registers, their `profiles` row is created with
`approved = false`. To approve them:

1. Supabase dashboard → **Table Editor → profiles**.
2. Find the row, check what they entered (name, location, description).
3. Set `approved` to `true`.

That's the entire review workflow for this MVP — deliberately manual, so a
person is always the one deciding who gets in.

## 4. Deploy

Any static host works — Netlify, Vercel, GitHub Pages, Cloudflare Pages.
Drag-and-drop the whole `ngo-connect` folder onto Netlify's dashboard, or
`vercel deploy` from inside it. No build step needed.

**Before deploying:** double check `js/supabaseClient.js` has your real
project URL and anon key, and that you've run `sql/schema.sql`.

---

## Security checklist (already handled in this build)

- **No secrets in the repo.** The only key in the frontend is the Supabase
  *anon* key, which is meant to be public — it can only do what the Row
  Level Security policies in `sql/schema.sql` allow. Never put your
  Supabase `service_role` key in frontend code.
- **Inputs validated.** Client-side checks (`js/auth.js`) plus real
  enforcement in Postgres — `not null`, length limits via `maxlength`,
  and `check` constraints on `role`/`status`/`institution_type`.
- **Least-privilege claiming.** NGOs don't get direct `UPDATE` rights on
  requirements. Claiming goes through the `claim_requirement()` Postgres
  function, which checks the caller is an approved NGO and that the item
  is still pending before touching anything.
- **Basic rate limiting.** `claim_requirement()` enforces a 10-second
  cooldown per NGO account. Supabase Auth has its own built-in rate
  limits on signup/login attempts.
- **No individual resident data.** The schema has no field for naming or
  describing individual children or elderly residents — only
  institution-level needs. Keep it that way as you extend this.
- **One dependency.** `@supabase/supabase-js` loaded from a pinned CDN
  version (`@2`). Check https://github.com/supabase/supabase-js/releases
  occasionally for security advisories.

**Known gap to revisit next cycle:** rate limiting on the public signup
endpoint itself relies entirely on Supabase Auth's defaults. If this gets
real traffic, put it behind Cloudflare or add a CAPTCHA on signup.

---

## One-page doc (fill in the demo link once deployed)

**Theme**
Orphanages and old age homes go unrecognized by NGOs — there's no shared
registry connecting the two, so real needs stay invisible.

**Demo**
`<your deployed URL here>` — register as an institution or NGO from the
homepage; institution accounts need approval before posting, NGO accounts
need approval before claiming (approve yourself via Table Editor to test
the full loop).

**Limits**
- Manual approval only, no automated identity verification.
- No in-app messaging — once an NGO claims a need, follow-up happens
  outside the platform using the contact details on file.
- No payments processed on-platform.
- No individual resident data, by design.

**Next steps**
- Institution-facing verification (e.g. registration number check).
- Optional public view for individual donors/volunteers.
- Notifications when a posted need is claimed.
- Contributor rotation: other regions running the same six-step cycle on
  local institution/NGO visibility gaps, logged in a shared repo.
