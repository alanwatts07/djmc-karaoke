import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!serviceRole) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

export const db = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export type SingerStatus =
  | "queued"
  | "getting_closer"
  | "on_deck"
  | "singing"
  | "done"
  | "hold";

export type Singer = {
  id: string;
  stage_name: string;
  song: string;
  submitted_at: string;
  queue_position: number;
  status: SingerStatus;
  notes: string | null;
  tip_total: number;
  singer_token: string | null;
  started_singing_at: string | null;
  finished_singing_at: string | null;
  archived_at: string | null;
  night_id: string | null;
};

export type Night = {
  id: string;
  name: string | null;
  started_at: string | null;
  ended_at: string;
  total_signups: number;
  total_sung: number;
  duration_seconds: number | null;
  mins_per_singer: number | null;
};

export type PublicSinger = Pick<
  Singer,
  "id" | "stage_name" | "song" | "submitted_at" | "status"
>;

export function toPublicSinger(s: Singer): PublicSinger {
  return {
    id: s.id,
    stage_name: s.stage_name,
    song: s.song,
    submitted_at: s.submitted_at,
    status: s.status,
  };
}
