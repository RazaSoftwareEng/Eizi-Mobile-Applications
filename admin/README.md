# Eizi Admin Portal

Web dashboard for Eizi administrators — React + Vite + Tailwind CSS v4 + Supabase (the same backend as the mobile app).

## What admins can do

| Page | Features |
| --- | --- |
| **Dashboard** | Daily check: new users today, bookings scheduled today, pending requests, completed value, last-7-days table, latest bookings |
| **Users** | Search & filter (new today / customers / providers / no role), see email + last sign-in, **add**, **edit** (name, phone, role), **delete** (removes the login and all their data) |
| **Services** | **Add / edit / delete** service categories, pick the icon shown in the app, see providers, bookings and starting price per service |
| **Provider listings** | Who offers what at which hourly rate — **add / edit / delete**, switch live/paused |
| **Bookings** | Filter by status and date, search, change status inline, **edit** (time, hours, address, notes — total recalculated), **create** on behalf of a customer, **delete** |

Only accounts listed in the `public.admins` table can sign in. Everyone else is signed straight back out.

## Setup

1. Run the latest [`../supabase/schema.sql`](../supabase/schema.sql) in **Supabase → SQL Editor** (safe to re-run; it adds the admin tables, policies and functions).
2. Make yourself an admin — in the SQL Editor, with your own email:

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```

   (Create the account first — sign up in the mobile app, or under **Authentication → Users → Add user**.)
3. Environment:

   ```bash
   cp .env.example .env   # fill VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
   ```

4. Run:

   ```bash
   npm install
   npm run dev      # http://localhost:5173
   npm run build    # production build in dist/
   ```

To remove an admin: `delete from public.admins where user_id = '…';`

## Security notes

- Admin rights come only from the `admins` table, which no app or API user can write to — only the SQL Editor (database owner).
- Every table has an extra RLS policy `admin full access` that checks `public.is_admin()`.
- User emails and last sign-in times stay private in `auth.users`; only admins can read them via `admin_list_accounts()`.
- Deleting a user goes through `admin_delete_user()`, which re-checks admin rights in the database.
- The portal uses only the public publishable key — never put the `service_role` key in this app.

## Deploy on Vercel

1. **Import** the Git repo in Vercel and set **Root Directory = `admin`** (the repo root is the Expo app).
   Framework preset: **Vite** · Build command `npm run build` · Output directory `dist`.
2. **Settings → Environment Variables** — add both (Production + Preview), using the same values as your local `admin/.env`:

   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | your publishable / anon key (never the `service_role` key) |

3. **Redeploy** (Deployments → ⋯ → Redeploy). Vite bakes env vars in at build time, so a redeploy is required after adding them.

`vercel.json` already rewrites every path to `index.html`, so refreshing `/users`, `/bookings` etc. works (no 404),
and adds `noindex` + basic security headers.
