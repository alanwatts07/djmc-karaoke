import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { isHostAuthed } from "@/lib/host-auth";
import { reconcileStatuses, compactPositions } from "@/lib/queue-ops";

export async function POST(req: Request) {
  if (!(await isHostAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { error } = await db.from("singers").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "server" }, { status: 500 });
  }

  await compactPositions();
  await reconcileStatuses();
  return NextResponse.json({ ok: true });
}
