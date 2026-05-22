@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See `README.md` for product overview and setup. This file covers what's not in the README.

## Commands

- `bun dev` — Next.js dev server (Turbopack)
- `bun run build` / `bun start` — production build / serve
- `bun run lint` — ESLint (config in `eslint.config.mjs`, extends `next`)
- `bun run test:queue` — end-to-end queue simulation against the *real* Supabase project. **It clears the `singers` table — never run during a live night.**
- `bun run test:queue:reset` — wipe the `singers` table

There is no unit test runner; `test:queue` is an integration script, not Jest/Vitest.

## Architecture: load-bearing details

### Service-role-only data access
The browser never gets a Supabase client. RLS has no anon policies; every read/write flows through Next.js route handlers in `app/api/*` using the service role key from `lib/supabase.ts`. This is what keeps `notes`, `queue_position`, and `tip_total` off the singer's status page. **Do not** add a client-side Supabase client or expose the anon key to React components.

### Queue position is the source of truth; status is derived
- `lib/queue-ops.ts::setQueueOrder` calls the Postgres `set_queue_order` RPC, which takes an advisory lock and renumbers `queue_position` in a single transaction. There is a unique constraint on `queue_position` for rotation rows, so any partial reorder will collide — always pass the *full* ordered id list.
- `lib/tiers.ts::recomputeStatuses` maps positions → `queued | getting_closer | on_deck`. The host-set sticky states (`singing | done | hold`) are never overwritten.
- After **any** mutation that touches `queue_position` or status, call `reconcileStatuses()` from `lib/queue-ops.ts`. Skipping this is the most common way to leave the queue in a bad state.

### Auth has two layers, both required
`proxy.ts` gates `/host/*` and `/api/host/*` via the HMAC cookie from `lib/host-auth.ts`. **Every host API route must also call `isHostAuthed()` itself** — per the Next.js 16 docs, proxy is not a security boundary. Mirror this pattern when adding new host routes.

### Singers identify themselves via a token
`lib/singer-token.ts` issues a signed token stored in a cookie; that's how `/me`, `/s/[id]`, and the singer-edit/delete endpoints (`app/api/me/*`) authorize the requesting singer without a password. Recent commits added singer self-service (edit/delete unsung songs, auto-route returning singers).

### Polling, not realtime
Singer pages poll `/api/s/[id]` every 5s; host dashboard polls every ~4s. Realtime is intentionally not used (it would leak private columns through Supabase's row-level publication). If you're tempted to add Supabase Realtime, don't.

## Next.js 16 specifics

This is **Next.js 16**, not 14/15. APIs and conventions in your training data may be wrong. Before writing route handlers, middleware (note: it's called `proxy.ts` here, not `middleware.ts`), or server actions, check `node_modules/next/dist/docs/` and heed deprecation notices.
