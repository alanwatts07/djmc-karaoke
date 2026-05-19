import { NextResponse } from "next/server";
import { db, type Singer } from "@/lib/supabase";
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

  // If there's already an active (non-done) row with this stage name AND it
  // has a singer_token (i.e. that person scanned the QR earlier), reuse the
  // token so the rotation algorithm treats them as the same person.
  const { data: existing } = await db
    .from("singers")
    .select("singer_token")
    .ilike("stage_name", name)
    .not("singer_token", "is", null)
    .neq("status", "done")
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle<Pick<Singer, "singer_token">>();

  const { error } = await db.from("singers").insert({
    stage_name: name,
    song: songText,
    singer_token: existing?.singer_token ?? null,
  });

  if (error) {
    console.error("host add failed", error);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }

  await compactPositions();
  await fairInterleave();
  return NextResponse.json({ ok: true });
}
