# Karaoke Queue

Self-serve karaoke sign-up app. Singers scan a QR, drop their name + song, and watch a status tier on their phone (no numeric position — see [`plan.md`](./plan.md) for the why). Host runs a private dashboard with drag-reorder, an Express Lane button, hold, lifecycle controls, private notes, and a tip log.

## Stack

- **Next.js 16** (App Router, React 19, Turbopack)
- **Supabase** (Postgres + service-role writes; no realtime — clients poll)
- **Tailwind v4** + **dnd-kit** for the drag-reorder
- Deploy: **Vercel**

## Setup

### 1. Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL Editor, paste and run [`supabase/schema.sql`](./supabase/schema.sql).
3. Project Settings → API → copy the **Project URL**, **anon key**, and **service_role key**.

### 2. Env

```bash
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
# pick a HOST_PASSWORD you'll remember
# generate HOST_COOKIE_SECRET:  openssl rand -hex 32
```

The service role key bypasses RLS — never expose it to the browser. Only the routes under `app/api/` use it.

### 3. Run

```bash
bun install   # or npm install
bun dev       # or npm run dev
```

Visit:

- `http://localhost:3000` — singer submit
- `http://localhost:3000/host` — host dashboard (will redirect to login)

## Routes

| Path | Purpose |
|------|---------|
| `/` | Singer submits stage name + song |
| `/s/[id]` | Singer's live status page (polls every 2.5s) |
| `/host/login` | Password gate |
| `/host` | Drag-reorder dashboard + lifecycle controls |
| `/api/s/[id]` | Public, safe-columns-only singer fetch |
| `/api/host/*` | All host mutations (auth-gated via `proxy.ts` + per-route check) |

## Architecture notes

- **No client-side Supabase.** The browser never gets the anon key — RLS is locked down (no anon policies). All reads/writes go through Next.js routes using the service role. This keeps `notes`, `queue_position`, and `tip_total` out of the singer's view.
- **Polling, not realtime.** Singer pages poll `/api/s/[id]` every 2.5s; the host dashboard polls every 4s. Realtime would have leaked private columns through Supabase's row-level publication.
- **Tier derivation lives in `lib/tiers.ts`.** Statuses `queued | getting_closer | on_deck` are auto-derived from `queue_position` after every mutation. `singing | done | hold` are sticky host-set states that don't get clobbered.
- **Auth.** Host cookie is an HMAC of the issued timestamp, signed with `HOST_COOKIE_SECRET`. `proxy.ts` redirects unauth'd `/host` traffic and 401s on `/api/host/*`; every host API route *also* calls `isHostAuthed()` itself (per the Next.js 16 docs, proxy alone isn't a security boundary).

## Day-of-night checklist

1. Print + laminate a sign with two QRs: app URL on the left, Venmo on the right (see `plan.md` for copy).
2. Use a dynamic QR (Bitly, QR Code Generator) so you can swap the underlying URL without reprinting.
3. Before the night: hit the URL once on your phone to wake the Supabase project (auto-pauses after 1 week of inactivity on the free tier).
4. Open `/host` on your phone or laptop. Bookmark `/host/login` if you've logged out.

## Deploying to Vercel

```bash
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add HOST_PASSWORD
vercel env add HOST_COOKIE_SECRET
vercel deploy --prod
```
