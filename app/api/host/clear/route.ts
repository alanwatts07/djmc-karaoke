import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { isHostAuthed } from "@/lib/host-auth";
import { compactPositions } from "@/lib/queue-ops";

// mode = "completed"  → delete only rows with status = 'done' (archive)
// mode = "all"        → wipe the entire queue (end of night)
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

  const query = db.from("singers").delete();
  const filtered =
    mode === "all"
      ? query.gte("submitted_at", "1970-01-01") // supabase-js requires a filter
      : query.eq("status", "done");

  const { error } = await filtered;
  if (error) {
    console.error("clear failed", error);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }

  await compactPositions();
  return NextResponse.json({ ok: true });
}
