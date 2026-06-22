# Deploying Catholiccolabs.com on Firebase App Hosting

This app is a Next.js (App Router) site with server-side auth, so it must run on
**Firebase App Hosting** — *not* classic Firebase Hosting (which is static-only).

## Prerequisites

- A Firebase project on the **Blaze (pay-as-you-go)** plan (App Hosting requires
  it; idle usage is typically free, but a billing account must be attached).
- This repo on GitHub: `cferns/Job-search`, app in the `catholiccolabs/` folder.

## 1. Create / pick a project

In the [Firebase console](https://console.firebase.google.com), create a project
(e.g. `catholiccolabs`) or reuse an existing one.

## 2. Create an App Hosting backend

1. Left sidebar → **Build → App Hosting** → **Get started**.
2. **Connect GitHub** and authorize access to `cferns/Job-search`.
3. Set:
   - **Repository**: `cferns/Job-search`
   - **Live branch**: `main` (merge this work into main first), or the working
     branch `claude/catholic-co-labs-d1ua8j`.
   - **Root directory**: `catholiccolabs`  ← important (monorepo)
4. Deploy. App Hosting reads `apphosting.yaml`, builds Next.js, and gives you a
   URL like `https://<backend>--<project>.<hash>.web.app`. Confirm it loads.

No environment variables are required — the Supabase connection (Vineyard-dev)
is built into the app as browser-safe defaults, and auth redirects are derived
from the request origin.

## 3. Connect the custom domain

1. App Hosting → your backend → **Domains** → **Add custom domain** →
   `catholiccolabs.com` (add `www.catholiccolabs.com` too if desired).
2. Firebase shows DNS records to create (an **A record** and a **TXT** record for
   verification; sometimes a CNAME for `www`).
3. In **Squarespace** (Domains → catholiccolabs.com → DNS → **Custom records**),
   add exactly what Firebase shows. Leave the existing `_domainconnect` and
   Google email records in place.
4. Wait for verification + automatic SSL (minutes to a few hours).

## 4. Point auth at the live domain (Supabase: Vineyard-dev)

In the Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL**: `https://catholiccolabs.com`
- **Redirect URLs**: add
  - `https://catholiccolabs.com/auth/callback`
  - `https://www.catholiccolabs.com/auth/callback`
  - the App Hosting `*.web.app` URL + `/auth/callback` (for testing before DNS)

Ensure the **Email**, **Google**, and **Apple** providers are enabled, and that
the Google/Apple OAuth credentials list the Supabase callback URL
(`https://kfrarmtbcaeulywpjdvw.supabase.co/auth/v1/callback`).

## Subsequent deploys

Every push to the live branch triggers an automatic rebuild + rollout.
