# Karaoke Queue — Plan

A self-serve karaoke sign-up app for running a live room. Singers scan a QR taped to the speaker, drop their name + song, and watch a status update on their phone. The host runs a private dashboard that keeps the rotation completely flexible without exposing that flexibility to the crowd.

---

## Core principle: the blind queue

Singers never see a numeric position. Telling someone "you're #4" sets a contract the host can't break — if a close friend walks in, or someone Venmos $20 to skip the line, dropping the original singer to #5 reads as betrayal even when it's the right call.

Front-end shows a **status tier** instead of a number:

- **In Queue** — submission received, no other promise
- **Getting Closer** — up in the next few rounds
- **On Deck** — next or second; warm up

Tier transitions are driven by the host's private ordering, not a public count. Bumping a VIP forward leaves the original singer's tier unchanged for one extra song; they never see a number tick the wrong way.

## Singer flow (front-end)

1. **Scan** — large laminated QR code on the speaker. Same sign also carries the Venmo QR with the line *"Tips expedite your rotation."*
2. **Submit** — stage name + song choice on one screen. No account creation.
3. **Receipt** — green check, "Submission received. You're locked into the rotation, [Name]. Grab a drink and listen for the host to call your name."
4. **Live status** — singer's page subscribes to their own row. Status text updates in place as their tier changes. No queue length, no other singers visible, no position number.

## Host control panel (private)

This is the real product. Behind a single password-gated route.

- **Drag-to-reorder** the full queue.
- **Express Lane button** next to every incoming submission — one click bumps that singer to the top of the pile or to the slot right after the current performer.
- **Hold toggle** — skip a singer in the rotation without removing them. For bathroom / bar runs.
- **Lifecycle controls** — queued → on deck → singing → done, without manual position math.
- **Private notes** per singer (`$20 tip`, `owner's friend`, `birthday`). Host-only, never sent to client.
- **Tip log** column — host pastes/types Venmo memos so payments line up with the queue.

## Data model

Separate **submission_time** (immutable) from **queue_position** (mutable, recomputed on reorder). Singer's phone only watches its own row's `status` field — reordering rewrites `queue_position` server-side and the client never sees it.

Singer row: `id`, `stage_name`, `song`, `submitted_at`, `queue_position`, `status` (`queued | getting_closer | on_deck | singing | done | hold`), `notes` (host-only), `tip_total`.

## Tip handling

- **Low-tech (launch):** host sees the Venmo push notification with the memo, finds the matching stage name in the dashboard, hits Express Lane. Two seconds.
- **High-tech (later):** Zapier rule or webhook on Venmo/Cash App receipts. Match memo text to a stage name, increment `tip_total`, auto-boost `queue_position`.

## Physical setup

One printed sign, laminated, taped to the speaker:

- Header: **SCAN TO SING**
- Left QR: app link → *"Scan to join the rotation. Drop your stage name & song instantly."*
- Right QR: Venmo → *"Tips appreciated and never required. Drop a tip with your stage name in the memo to expedite your song."*

Use a **dynamic** QR (e.g. Bitly or QR Code Generator) so the underlying URL can be swapped later without reprinting the sign.

## Stack

- **Frontend:** Astro + a small interactive island for the live status screen, or plain Next.js if we want server-side host auth out of the box. Mobile-first — singers will use it on their phones.
- **Realtime data:** Supabase (Postgres + row-level subscriptions). Free tier easily handles a bar.
- **Auth:** singers — none. Host — single password-gated route via Supabase Auth, or a shared-secret URL.
- **Deploy:** Vercel.

## What's next

1. Pick a stack (recommend Astro + Supabase).
2. Pick a name and grab a domain — e.g. `quickmic.app`, `mic-up.com`, `getonthemic.com`.
3. Sketch the two screens that matter: singer submit/receipt/status, and the host dashboard with drag-to-reorder + Express Lane.
4. Build the singer side first (it's small and stable). Then the host dashboard.
5. Print + laminate the dual-QR sign before the first real night running it.
