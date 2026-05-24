import { NextResponse } from "next/server";
import { db, type Singer } from "@/lib/supabase";
import { isHostAuthed } from "@/lib/host-auth";
import { setSessionOpen } from "@/lib/session";

// Closes out the current bar night. Computes stats from every row that
// doesn't already belong to a night (active queue + soft-archived rows),
// creates a `nights` row with the totals, then stamps `night_id` on all
// those rows so the next session starts with a clean active queue.
//
// Stats math:
//   total_signups    = count of all rows for the night (sung or not)
//   total_sung       = rows with started_singing_at NOT NULL
//   started_at       = MIN(started_singing_at)
//   ended_at         = NOW() (when host hit the button)
//   duration_seconds = MAX(started_singing_at) - MIN(started_singing_at)
//   mins_per_singer  = duration / total_sung / 60
export async function POST(req: Request) {
  if (!(await isHostAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { name } = (await req.json().catch(() => ({}))) as { name?: string };

  const { data: rows, error: fetchErr } = await db
    .from("singers")
    .select("*")
    .is("night_id", null)
    .returns<Singer[]>();
  if (fetchErr) {
    console.error("end-night fetch failed", fetchErr);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
  // No active rows: nothing to archive, but still flip the session closed
  // so this can be used as a "stop accepting submissions" toggle even when
  // nobody has signed up yet.
  if (!rows || rows.length === 0) {
    await setSessionOpen(false);
    return NextResponse.json({ ok: true, archived: false });
  }

  const sung = rows.filter((r) => r.started_singing_at !== null);

  // Night start = when the very first singer began singing.
  // Night end   = when the host hit Done on the final singer of the night
  //              (NOT when "End the night" was clicked — the bar could've
  //              been quiet for an hour before the host wrapped things up).
  const startTimes = sung
    .map((r) => new Date(r.started_singing_at!).getTime())
    .sort((a, b) => a - b);
  const finishTimes = sung
    .filter((r) => r.finished_singing_at !== null)
    .map((r) => new Date(r.finished_singing_at!).getTime())
    .sort((a, b) => a - b);

  const startedAt = startTimes.length > 0 ? new Date(startTimes[0]) : null;
  const lastDoneAt =
    finishTimes.length > 0
      ? new Date(finishTimes[finishTimes.length - 1])
      : startTimes.length > 0
        ? new Date(startTimes[startTimes.length - 1]) // fallback for pre-migration rows
        : null;

  const durationSeconds =
    startedAt && lastDoneAt && lastDoneAt.getTime() > startedAt.getTime()
      ? Math.round((lastDoneAt.getTime() - startedAt.getTime()) / 1000)
      : null;
  const minsPerSinger =
    durationSeconds !== null && sung.length > 0
      ? Number((durationSeconds / sung.length / 60).toFixed(2))
      : null;

  const { data: night, error: insertErr } = await db
    .from("nights")
    .insert({
      name: name?.trim() || null,
      started_at: startedAt?.toISOString() ?? null,
      ended_at: lastDoneAt?.toISOString() ?? new Date().toISOString(),
      total_signups: rows.length,
      total_sung: sung.length,
      duration_seconds: durationSeconds,
      mins_per_singer: minsPerSinger,
    })
    .select("id")
    .single();

  if (insertErr || !night) {
    console.error("end-night insert failed", insertErr);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }

  // Stamp the night_id on every row that was open. Use the same filter we
  // used to fetch — any new submission that snuck in between fetch and now
  // intentionally stays in the next night.
  const { error: stampErr } = await db
    .from("singers")
    .update({ night_id: night.id, archived_at: new Date().toISOString() })
    .is("night_id", null);

  if (stampErr) {
    console.error("end-night stamp failed", stampErr);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }

  // Flip the session closed so the / page goes back to the promo splash
  // and public submissions are refused until Begin is hit again.
  await setSessionOpen(false);

  return NextResponse.json({
    ok: true,
    archived: true,
    night_id: night.id,
    total_signups: rows.length,
    total_sung: sung.length,
  });
}
