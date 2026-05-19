import { NextResponse } from "next/server";
import { db, type SingerStatus } from "@/lib/supabase";
import { isHostAuthed } from "@/lib/host-auth";
import { reconcileStatuses, compactPositions } from "@/lib/queue-ops";

const ALLOWED: SingerStatus[] = [
  "queued",
  "getting_closer",
  "on_deck",
  "singing",
  "done",
  "hold",
];

export async function POST(req: Request) {
  if (!(await isHostAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id, status } = (await req.json().catch(() => ({}))) as {
    id?: string;
    status?: SingerStatus;
  };
  if (!id || !status || !ALLOWED.includes(status)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (status === "singing") {
    // Only one person can be singing at a time.
    await db.from("singers").update({ status: "done" }).eq("status", "singing");
  }

  const { error } = await db.from("singers").update({ status }).eq("id", id);
  if (error) {
    console.error("status update failed", error);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }

  // compactPositions enforces bucket order (singing → rotation → hold → done)
  // so done/hold rows automatically settle into the right band of the queue.
  await compactPositions();
  await reconcileStatuses();
  return NextResponse.json({ ok: true });
}
