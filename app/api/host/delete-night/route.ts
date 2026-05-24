import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { isHostAuthed } from "@/lib/host-auth";

// Permanently delete a closed night and all its singer rows. Used for
// cleaning up "test night" archives created during visual testing.
export async function POST(req: Request) {
  if (!(await isHostAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // Delete the singer rows belonging to this night first, then the night.
  // The night_id foreign key is ON DELETE SET NULL, but we want a clean
  // wipe — no orphan singer rows lingering with null night_id.
  const { error: singersErr } = await db
    .from("singers")
    .delete()
    .eq("night_id", id);
  if (singersErr) {
    console.error("delete-night singers failed", singersErr);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }

  const { error: nightErr } = await db.from("nights").delete().eq("id", id);
  if (nightErr) {
    console.error("delete-night night failed", nightErr);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
