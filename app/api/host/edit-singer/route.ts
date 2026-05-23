import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { isHostAuthed } from "@/lib/host-auth";

// Host can update stage_name and/or song on any row in the active session.
// Unlike /api/me/edit, no ownership check (host is authoritative) and the
// row's status doesn't lock the edit — host can fix a typo even after a
// singer's been marked Singing.
export async function POST(req: Request) {
  if (!(await isHostAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id, stage_name, song } = (await req.json().catch(() => ({}))) as {
    id?: string;
    stage_name?: string;
    song?: string;
  };
  if (!id) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const update: { stage_name?: string; song?: string } = {};

  if (stage_name !== undefined) {
    const trimmed = stage_name.trim();
    if (!trimmed || trimmed.length > 60) {
      return NextResponse.json({ error: "bad_name" }, { status: 400 });
    }
    update.stage_name = trimmed;
  }

  if (song !== undefined) {
    const trimmed = song.trim();
    if (!trimmed || trimmed.length > 120) {
      return NextResponse.json({ error: "bad_song" }, { status: 400 });
    }
    update.song = trimmed;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }

  const { error } = await db.from("singers").update(update).eq("id", id);
  if (error) {
    console.error("host edit-singer failed", error);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
