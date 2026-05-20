import { NextResponse } from "next/server";
import { db, type Singer } from "@/lib/supabase";
import { getSingerToken } from "@/lib/singer-token";

// Singers can only edit rows they own (matched by cookie token) AND only
// while the song is still in play. Once it's singing or done, the row locks.
export async function POST(req: Request) {
  const token = await getSingerToken();
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id, song } = (await req.json().catch(() => ({}))) as {
    id?: string;
    song?: string;
  };
  const songText = (song ?? "").trim();
  if (!id || !songText || songText.length > 120) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { data: row } = await db
    .from("singers")
    .select("status, singer_token")
    .eq("id", id)
    .maybeSingle<Pick<Singer, "status" | "singer_token">>();

  if (!row || row.singer_token !== token) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (row.status === "singing" || row.status === "done") {
    return NextResponse.json({ error: "locked" }, { status: 403 });
  }

  const { error } = await db
    .from("singers")
    .update({ song: songText })
    .eq("id", id);
  if (error) {
    console.error("singer edit failed", error);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
