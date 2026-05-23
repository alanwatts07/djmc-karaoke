import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { isHostAuthed } from "@/lib/host-auth";
import { compactPositions } from "@/lib/queue-ops";

// mode = "completed"  → soft-archive done rows (sets archived_at, KEEPS data
//                       for stats — folded into the night when host clicks
//                       "End the night")
// mode = "all"        → hard delete (truly nuclear — bypasses stats)
export async function POST(req: Request) {
  if (!(await isHostAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { mode } = (await req.json().catch(() => ({}))) as {
    mode?: "all" | "completed";
  };

  if (mode !== "all" && mode !== "completed") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (mode === "completed") {
    const { error } = await db
      .from("singers")
      .update({ archived_at: new Date().toISOString() })
      .eq("status", "done")
      .is("archived_at", null)
      .is("night_id", null);
    if (error) {
      console.error("archive failed", error);
      return NextResponse.json({ error: "server" }, { status: 500 });
    }
    await compactPositions();
    return NextResponse.json({ ok: true });
  }

  // mode === "all" — actual hard delete, only of the active session.
  // Closed-night rows are protected by the night_id filter.
  const { error } = await db
    .from("singers")
    .delete()
    .is("night_id", null)
    .gte("submitted_at", "1970-01-01");
  if (error) {
    console.error("clear failed", error);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }

  await compactPositions();
  return NextResponse.json({ ok: true });
}
