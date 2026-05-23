import { NextResponse } from "next/server";
import { db, type Night } from "@/lib/supabase";
import { isHostAuthed } from "@/lib/host-auth";

// Host can fix up an archived night's metadata after the fact — useful for
// nights that were archived without timestamps (rows that pre-date the
// started_singing_at column, e.g. the first night after migration).
//
// Editable: name, started_at, ended_at, total_signups, total_sung.
// Recomputes duration_seconds and mins_per_singer from the timestamps + sung.
//
// Send a field as null to clear it; omit a field to leave it unchanged.
export async function POST(req: Request) {
  if (!(await isHostAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    name?: string | null;
    started_at?: string | null;
    ended_at?: string | null;
    total_signups?: number | null;
    total_sung?: number | null;
  };

  if (!body.id) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { data: existing, error: readErr } = await db
    .from("nights")
    .select("*")
    .eq("id", body.id)
    .maybeSingle<Night>();
  if (readErr || !existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const next = {
    name: body.name !== undefined ? body.name : existing.name,
    started_at:
      body.started_at !== undefined ? body.started_at : existing.started_at,
    ended_at:
      body.ended_at !== undefined
        ? body.ended_at ?? existing.ended_at // ended_at is NOT NULL — fall back to existing
        : existing.ended_at,
    total_signups:
      body.total_signups !== undefined
        ? body.total_signups ?? existing.total_signups
        : existing.total_signups,
    total_sung:
      body.total_sung !== undefined
        ? body.total_sung ?? existing.total_sung
        : existing.total_sung,
  };

  // Recompute derived stats from the new timestamps.
  let duration_seconds: number | null = null;
  let mins_per_singer: number | null = null;
  if (next.started_at && next.ended_at) {
    const startMs = new Date(next.started_at).getTime();
    const endMs = new Date(next.ended_at).getTime();
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
      duration_seconds = Math.round((endMs - startMs) / 1000);
      if (next.total_sung > 0) {
        mins_per_singer = Number(
          (duration_seconds / next.total_sung / 60).toFixed(2),
        );
      }
    }
  }

  const { error } = await db
    .from("nights")
    .update({
      name: next.name,
      started_at: next.started_at,
      ended_at: next.ended_at,
      total_signups: next.total_signups,
      total_sung: next.total_sung,
      duration_seconds,
      mins_per_singer,
    })
    .eq("id", body.id);

  if (error) {
    console.error("edit-night failed", error);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
