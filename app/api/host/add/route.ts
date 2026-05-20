import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { isHostAuthed } from "@/lib/host-auth";
import { fairInterleave, compactPositions } from "@/lib/queue-ops";

export async function POST(req: Request) {
  if (!(await isHostAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { stage_name, song } = (await req.json().catch(() => ({}))) as {
    stage_name?: string;
    song?: string;
  };

  const name = (stage_name ?? "").trim();
  const songText = (song ?? "").trim();
  if (!name || name.length > 60 || !songText || songText.length > 120) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // Host-added rows are never owned by any singer's token. We used to inherit
  // a matching name's token so the rotation treated them as the same person,
  // but that let the real "Matt" edit/delete the host's added row via /me.
  // Different humans can share a name at a bar — the host can use Express
  // Lane to position duplicate names manually.
  const { error } = await db.from("singers").insert({
    stage_name: name,
    song: songText,
    singer_token: null,
  });

  if (error) {
    console.error("host add failed", error);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }

  await compactPositions();
  await fairInterleave();
  return NextResponse.json({ ok: true });
}
