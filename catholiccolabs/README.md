# Catholiccolabs.com

The Catholiccolabs landing & authentication experience — _Create. Share.
Inspire. Together in Faith._

Built with **Next.js (App Router) + TypeScript + Tailwind CSS** and
**Supabase Auth** (`@supabase/ssr`).

## Features

- Pixel-faithful split-screen landing/login page (faith illustration + form card).
- Email + password sign-in (and sign-up server action).
- **Continue with Google** and **Continue with Apple** OAuth.
- Forgot-password → email reset link → set-new-password flow.
- Cookie-based SSR sessions with middleware that refreshes the session and
  guards protected routes (`/dashboard`).
- Sign-out.

## Getting started

```bash
npm install
cp .env.local.example .env.local   # then fill in your Supabase values
npm run dev
```

Open http://localhost:3000.

## Environment variables

| Variable                        | Where to find it                                   |
| ------------------------------- | -------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase dashboard → Project Settings → API        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API        |
| `NEXT_PUBLIC_SITE_URL`          | Your site origin (e.g. `https://catholiccolabs.com`) |

## Supabase configuration

1. **URL Configuration** (Authentication → URL Configuration):
   - _Site URL_: your production origin (e.g. `https://catholiccolabs.com`).
   - _Redirect URLs_: add `http://localhost:3000/auth/callback` and
     `https://your-domain/auth/callback`.
2. **Email** (Authentication → Providers → Email): enable it. Confirmation and
   recovery emails link back to `/auth/callback`, which exchanges the code for a
   session.
3. **Google** (Authentication → Providers → Google): add your Google OAuth
   client ID/secret. In Google Cloud, set the authorized redirect URI to
   `https://<your-project-ref>.supabase.co/auth/v1/callback`.
4. **Apple** (Authentication → Providers → Apple): add your Apple Services ID,
   Team ID, Key ID and private key, with the same Supabase callback URL.

No Supabase code changes are needed when you get the credentials — just drop
them into `.env.local` (and your hosting provider's env settings).

## Project structure

```
app/
  page.tsx                 # Landing / login page
  actions.ts               # Server actions (login, signup, OAuth, reset, signout)
  forgot-password/         # Request a reset link
  reset-password/          # Set a new password
  dashboard/               # Protected post-login page
  auth/callback/route.ts   # OAuth + email/recovery code exchange
components/                # AuthShell, form fields, OAuth buttons, alerts
lib/supabase/              # Browser/server/middleware clients + env helpers
middleware.ts              # Session refresh + route protection
public/images/hero.png     # Faith illustration
```
