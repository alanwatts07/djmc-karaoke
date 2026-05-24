import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { isHostAuthed } from "@/lib/host-auth";
import { compactPositions } from "@/lib/queue-ops";

// Clears any prior [Test]-prefixed rows from the active session. The
// dashboard's "Seed test queue" button calls this first, then fires a
// series of /api/host/add calls one at a time with a delay so the host
// can watch the rotation algorithm rearrange in real time.
export async function POST() {
  if (!(await isHostAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { error } = await db
    .from("singers")
    .delete()
    .ilike("stage_name", "[Test]%")
    .is("night_id", null);
  if (error) {
    console.error("seed-test clear failed", error);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }

  await compactPositions();
  return NextResponse.json({ ok: true });
}
