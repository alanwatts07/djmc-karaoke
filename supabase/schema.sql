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
do $$ begin
  alter table public.singers
    add constraint singers_queue_position_unique
    unique (queue_position) deferrable initially deferred;
exception when duplicate_object then null; end $$;

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

-- Atomic queue renumber. Pass the full ordered id list; this function takes
-- the advisory lock, parks every row at a negative slot in pass 1 so the
-- unique constraint can't trip mid-renumber, then writes the final positive
-- positions in pass 2. Both passes share one transaction.
create or replace function public.set_queue_order(ordered_ids uuid[])
returns void language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtext('singers_queue'));

  update public.singers
    set queue_position = -t.ord
    from unnest(ordered_ids) with ordinality as t(uid, ord)
    where singers.id = t.uid;

  update public.singers
    set queue_position = t.ord
    from unnest(ordered_ids) with ordinality as t(uid, ord)
    where singers.id = t.uid;
end $$;

-- Lock the table down. No anon policies = no anon access. The server uses
-- the service role key, which bypasses RLS.
alter table public.singers enable row level security;
revoke all on public.singers from anon, authenticated;
