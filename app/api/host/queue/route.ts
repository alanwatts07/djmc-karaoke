import { NextResponse } from "next/server";
import { db, type Singer } from "@/lib/supabase";
import { isHostAuthed } from "@/lib/host-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isHostAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Active session only. archived_at-set rows (mid-night declutter) and
  // night_id-set rows (closed nights) live in the stats history at /host/stats.
  const { data, error } = await db
    .from("singers")
    .select("*")
    .is("night_id", null)
    .is("archived_at", null)
    .order("queue_position", { ascending: true })
    .returns<Singer[]>();

  if (error) {
    console.error("queue fetch failed", error);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }

  return NextResponse.json({ singers: data ?? [] }, {
    headers: { "Cache-Control": "no-store" },
  });
}
