# Eizi

Home services booking app — like Yango for rides, but for a dishwasher, cook, electrician, plumber and more.
Customers book a provider **by the hour**; providers set their own **hourly price**.

Built with **Expo SDK 58 + Expo Router**, **NativeWind (Tailwind CSS)** and **Supabase**.

## App flow

1. **Login / Sign up** (email + password)
2. **Choose role** — Customer ("I need a service") or Service provider ("I provide a service")
3. **Provider**: My services → Add service → pick e.g. *Cook* → set price per hour (e.g. Rs 500/hr)
4. **Customer**: pick a service → see providers and their hourly rates → **Book now** → choose hours (1, 2, 3 … 12),
   day, start time, address → see the total (rate × hours) → **Book**
5. **Provider** gets the request → **Accept / Reject** → **Mark as completed**
6. **Customer** sees the status in *Bookings*, and can cancel while it is pending or accepted

Either side can switch role later from **Profile**.

## Setup

### 1. Supabase

1. Create a project at <https://supabase.com>.
2. Open **SQL Editor → New query**, paste all of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
   It creates the tables, security rules (RLS), price triggers and 12 starter services.
3. For quick testing, turn off email confirmation: **Authentication → Sign In / Providers → Email → Confirm email = off**.
   (If you leave it on, users must click the email link before logging in.)
4. Copy the **Project URL** and **publishable (anon) key** from **Project Settings → API Keys**.

### 2. Environment

```bash
cp .env.example .env
```

Fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

### 3. Run

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** (Android/iOS). Use `npx expo start --clear` after changing config files.

## Project structure

```
src/
  app/                    ← screens (Expo Router: every file is a route)
    _layout.tsx           root stack + AuthProvider + global.css
    index.tsx             redirects: login → role → customer / provider
    (auth)/login.tsx, signup.tsx
    role.tsx              customer / provider picker
    customer/             side-menu (drawer): Home, My bookings, Profile
    provider/             side-menu (drawer): Dashboard, My services, Profile
    service/[id].tsx      providers offering a service + their hourly rate
    book/[id].tsx         hours, day, time, address, price summary
    add-service.tsx       provider adds / edits a service and hourly rate
  components/             UI kit (Button, Input, Chip…), BookingCard, ProfileScreen, RoleDrawer (top bar + side menu)
  lib/                    supabase client, types, formatting
  providers/AuthProvider.tsx   session + profile
supabase/schema.sql       database, RLS policies, triggers, seed data
```

## Public website + admin portal

One web app in [`admin/`](admin/): the public website (`/`, `/about`, `/contact`) and the admin portal (`/admin`). See [admin/README.md](admin/README.md).

## Admin portal

The web admin portal is in [`admin/`](admin/) — see [admin/README.md](admin/README.md) for setup and how to make yourself an admin.

## Security notes

- The booking price is computed **in the database** from the provider's current rate (`hourly_rate × hours`),
  so the app cannot send a fake total.
- Only the booking status can change after creation, and only through valid steps
  (customer: cancel; provider: accept / reject → complete).
- Row Level Security: users only see their own bookings; providers can only edit their own services.

## Ideas for next steps

- Phone OTP login (needs an SMS provider in Supabase Auth)
- Push notifications for new requests (`expo-notifications`)
- Ratings & reviews, provider photos/ID verification
- Realtime updates on the Requests screen (`supabase.channel(...)`)
- Map/location picker for the address

## Automatic APK builds & live updates (EAS)

Every push to `main` runs [.eas/workflows/deploy-android.yml](.eas/workflows/deploy-android.yml) on Expo's servers:

| What changed | What happens | Installed APKs |
| --- | --- | --- |
| JS / UI only (screens, styles, logic, text) | an **OTA update** is published to the `production` channel | download it automatically on next launch; a "New version ready · Restart" banner lets users apply it immediately |
| Native side (new native package, icon/splash, permissions, Expo SDK upgrade) | a **new APK** is built (`production` profile) | download & install the new APK once (link on expo.dev) |

Decided by the app's **fingerprint** (`runtimeVersion.policy = "fingerprint"`), so an OTA update is never sent to an APK it would break.
Add `[eas skip]` to a commit message to skip the workflow.

### One-time setup

```bash
npx eas-cli@latest login               # your Expo account
npx eas-cli@latest init                # creates the EAS project, adds extra.eas.projectId to app.json
npx eas-cli@latest update:configure    # adds updates.url to app.json
```

Add the Supabase variables to EAS (cloud builds don't see your local `.env`):

```bash
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value "https://<ref>.supabase.co" --visibility plaintext
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value "<publishable key>" --visibility plaintext
```

Then on **expo.dev → your project → GitHub**, install the Expo GitHub app and link this repository. Commit the `app.json` changes and push to `main` — the first push builds the first APK.

Manual commands: `npx eas-cli@latest build -p android --profile production` (APK) · `npx eas-cli@latest update --channel production --environment production -m "message"` (OTA).
