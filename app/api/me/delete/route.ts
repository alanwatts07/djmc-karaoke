import { NextResponse } from "next/server";
import { db, type Singer } from "@/lib/supabase";
import { getSingerToken } from "@/lib/singer-token";
import { compactPositions } from "@/lib/queue-ops";

// Same ownership + lock rules as edit.
export async function POST(req: Request) {
  const token = await getSingerToken();
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) {
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

  const { error } = await db.from("singers").delete().eq("id", id);
  if (error) {
    console.error("singer delete failed", error);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }

  await compactPositions();
  return NextResponse.json({ ok: true });
}
