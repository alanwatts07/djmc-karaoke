-- Karaoke queue schema. Run once in the Supabase SQL editor.
-- Safe to re-run.
--
-- Security model: the browser never touches Supabase directly. All reads and
-- writes go through Next.js routes that use the SUPABASE_SERVICE_ROLE_KEY.
-- RLS is enabled with no anon policies, so even if the anon key leaks, the
-- database is read- and write-protected.

create extension if not exists "pgcrypto";

do $$ begin
  create type singer_status as enum (
    'queued',
    'getting_closer',
    'on_deck',
    'singing',
    'done',
    'hold'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.singers (
  id             uuid primary key default gen_random_uuid(),
  stage_name     text not null check (char_length(stage_name) between 1 and 60),
  song           text not null check (char_length(song)       between 1 and 120),
  submitted_at   timestamptz not null default now(),
  queue_position integer not null,
  status         singer_status not null default 'queued',
  notes          text,
  tip_total      integer not null default 0,
  singer_token   text
);

-- For existing installs: add singer_token if the column doesn't exist yet.
alter table public.singers
  add column if not exists singer_token text;

create index if not exists singers_queue_position_idx on public.singers (queue_position);
create index if not exists singers_status_idx         on public.singers (status);
create index if not exists singers_singer_token_idx   on public.singers (singer_token);

-- One-time renumber. Run before the unique constraint goes on, so any
-- pre-existing duplicates or gaps from the old non-atomic update path get
-- collapsed to a clean 1..N. Safe to re-run (idempotent once data is clean).
with renum as (
  select id,
         row_number() over (order by queue_position, submitted_at) as new_pos
  from public.singers
)
update public.singers s
set queue_position = renum.new_pos
from renum
where s.id = renum.id
  and s.queue_position is distinct from renum.new_pos;

-- queue_position must be unique. DEFERRABLE INITIALLY DEFERRED is required so
-- set_queue_order() (below) can do its two-pass renumber within a single tx
-- without tripping the constraint on intermediate values.
--
-- Re-run safety: check pg_constraint first instead of catching the error,
-- since Postgres can throw either duplicate_object OR duplicate_table here
-- depending on which path the constraint took.
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'singers_queue_position_unique'
  ) then
    alter table public.singers
      add constraint singers_queue_position_unique
      unique (queue_position) deferrable initially deferred;
  end if;
end $$;

-- Serialize all queue mutations through this advisory-lock key. Both the
-- insert trigger and set_queue_order() acquire it so concurrent submissions,
-- reorders, and express bumps can never interleave their position writes.
-- Lock is transaction-scoped → released automatically on commit/rollback.

-- Auto-assign queue_position on insert: append to the end.
create or replace function public.assign_queue_position()
returns trigger language plpgsql as $$
begin
  if new.queue_position is null or new.queue_position = 0 then
    perform pg_advisory_xact_lock(hashtext('singers_queue'));
    select coalesce(max(queue_position), 0) + 1
      into new.queue_position
      from public.singers
      where queue_position > 0;
  end if;
  return new;
end $$;

drop trigger if exists singers_assign_position on public.singers;
create trigger singers_assign_position
  before insert on public.singers
  for each row execute function public.assign_queue_position();

-- One-time fix for the cross-session collision bug: any rows from closed
-- nights (or mid-night soft-archives) still sitting in the active 1..N range
-- get pushed to a high "archive zone" so future set_queue_order calls for
-- the active session can write 1..N without unique-constraint collisions.
-- Idempotent — the < 1000000 guard means rerunning is a no-op.
update public.singers
set queue_position = 1000000 + queue_position
where queue_position between 1 and 999999
  and (night_id is not null or archived_at is not null);

-- Atomic queue renumber with self-healing collision protection.
--   Phase 1: park every listed row at a negative slot (so we can freely
--            write positive values without the deferred unique constraint
--            tripping on the listed rows' own current positions).
--   Phase 2: evict any OTHER rows currently sitting in 1..N to the archive
--            zone (1_000_000+) so they can't collide with the final write.
--            This catches closed-night and soft-archived rows; once moved,
--            they stay parked because future calls won't touch them.
--   Phase 3: write the listed rows to their final 1..N positions.
-- All three phases share one transaction; the constraint is checked at
-- commit, after all rows are at their final non-colliding values.
create or replace function public.set_queue_order(ordered_ids uuid[])
returns void language plpgsql as $$
declare
  n int;
  archive_top int;
begin
  perform pg_advisory_xact_lock(hashtext('singers_queue'));
  n := coalesce(array_length(ordered_ids, 1), 0);
  if n = 0 then return; end if;

  -- Phase 1: park listed rows at negative slots.
  update public.singers
    set queue_position = -t.ord
    from unnest(ordered_ids) with ordinality as t(uid, ord)
    where singers.id = t.uid;

  -- Phase 2: evict any colliders sitting in 1..N to the archive zone.
  -- archive_top = highest position currently in use up there (or 999999 if
  -- the zone is empty), so evicted rows get archive_top + 1, +2, +3, ...
  -- guaranteed unique against existing archive-zone occupants.
  select coalesce(max(queue_position), 999999)
    into archive_top
    from public.singers
    where queue_position >= 1000000;

  with collisions as (
    select id,
           row_number() over (order by queue_position) as rn
    from public.singers
    where queue_position between 1 and n
      and id <> all(ordered_ids)
  )
  update public.singers s
    set queue_position = archive_top + c.rn
    from collisions c
    where s.id = c.id;

  -- Phase 3: write listed rows to their final 1..N positions.
  update public.singers
    set queue_position = t.ord
    from unnest(ordered_ids) with ordinality as t(uid, ord)
    where singers.id = t.uid;
end $$;

-- ===========================================================================
-- Night archive / stats
-- ===========================================================================
-- Each completed bar night becomes a row in `nights`. Singers get a night_id
-- when the host clicks "End the night"; archived_at is a soft-delete for
-- mid-night declutter (lets the host hide "Done" rows from the active queue
-- without losing them for stats).

create table if not exists public.nights (
  id               uuid primary key default gen_random_uuid(),
  name             text,
  started_at       timestamptz,                        -- first started_singing_at this night
  ended_at         timestamptz not null default now(),
  total_signups    integer not null default 0,
  total_sung       integer not null default 0,
  duration_seconds integer,                            -- last_sung - first_sung (null if 0/1 sung)
  mins_per_singer  numeric(6,2)                        -- duration / total_sung / 60
);
create index if not exists nights_ended_at_idx on public.nights (ended_at desc);

alter table public.singers
  add column if not exists started_singing_at  timestamptz,
  add column if not exists finished_singing_at timestamptz,
  add column if not exists archived_at         timestamptz,
  add column if not exists night_id            uuid references public.nights(id) on delete set null;

create index if not exists singers_night_id_idx     on public.singers (night_id);
create index if not exists singers_archived_at_idx  on public.singers (archived_at);

-- ===========================================================================
-- App state — single-row table that holds runtime flags. Currently only used
-- for session_open (whether public submissions are accepted right now).
-- Defaults to TRUE so deploying this migration doesn't break in-flight nights.
-- ===========================================================================
create table if not exists public.app_state (
  id           text primary key default 'singleton',
  session_open boolean not null default true,
  constraint app_state_singleton check (id = 'singleton')
);

insert into public.app_state (id, session_open)
values ('singleton', true)
on conflict (id) do nothing;

-- Lock the tables down. No anon policies = no anon access. The server uses
-- the service role key, which bypasses RLS.
alter table public.singers   enable row level security;
alter table public.nights    enable row level security;
alter table public.app_state enable row level security;
revoke all on public.singers   from anon, authenticated;
revoke all on public.nights    from anon, authenticated;
revoke all on public.app_state from anon, authenticated;
