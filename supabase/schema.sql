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

-- Auto-assign queue_position on insert: append to the end.
create or replace function public.assign_queue_position()
returns trigger language plpgsql as $$
begin
  if new.queue_position is null or new.queue_position = 0 then
    select coalesce(max(queue_position), 0) + 1
      into new.queue_position
      from public.singers;
  end if;
  return new;
end $$;

drop trigger if exists singers_assign_position on public.singers;
create trigger singers_assign_position
  before insert on public.singers
  for each row execute function public.assign_queue_position();

-- Lock the table down. No anon policies = no anon access. The server uses
-- the service role key, which bypasses RLS.
alter table public.singers enable row level security;
revoke all on public.singers from anon, authenticated;
