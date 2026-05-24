import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { isHostAuthed } from "@/lib/host-auth";
import { fairInterleave, compactPositions } from "@/lib/queue-ops";

// Eight pre-baked singers for visually testing the dashboard. Mix of one-song
// singers and one with three songs so the rotation logic has something
// interesting to interleave. All names prefixed with "[Test]" so they're
// visually obvious and easy to filter out.
const TEST_SINGERS: { stage_name: string; song: string }[] = [
  { stage_name: "[Test] Alice", song: "Wonderwall" },
  { stage_name: "[Test] Bob", song: "Mr. Brightside" },
  { stage_name: "[Test] Carol", song: "Africa" },
  { stage_name: "[Test] Bob", song: "Bohemian Rhapsody" },
  { stage_name: "[Test] Dan", song: "Hotel California" },
  { stage_name: "[Test] Eve", song: "Sweet Caroline" },
  { stage_name: "[Test] Bob", song: "Don't Stop Believin'" },
  { stage_name: "[Test] Frank", song: "Take On Me" },
];

export async function POST() {
  if (!(await isHostAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Wipe any prior test rows from the active session so re-clicking the
  // button doesn't accumulate. Scoped to active session only — closed
  // nights are untouched.
  await db
    .from("singers")
    .delete()
    .ilike("stage_name", "[Test]%")
    .is("night_id", null);

  // Insert one at a time and run fairInterleave between each so the
  // simulated arrival order matches what happens in production.
  for (const s of TEST_SINGERS) {
    await db.from("singers").insert({
      stage_name: s.stage_name,
      song: s.song,
      singer_token: null,
    });
    await fairInterleave();
  }

  await compactPositions();
  return NextResponse.json({ ok: true, count: TEST_SINGERS.length });
}
