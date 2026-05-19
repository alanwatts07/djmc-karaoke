import { NextResponse } from "next/server";
import { db, type Singer } from "@/lib/supabase";
import { isHostAuthed } from "@/lib/host-auth";
import { reconcileStatuses, compactPositions } from "@/lib/queue-ops";

// Bump a singer to the slot right after the currently-singing person (or to
// the top if nobody is singing). Other rotation singers slide down by one.
export async function POST(req: Request) {
  if (!(await isHostAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { data, error } = await db
    .from("singers")
    .select("*")
    .order("queue_position", { ascending: true })
    .returns<Singer[]>();
  if (error || !data) {
    return NextResponse.json({ error: "server" }, { status: 500 });
  }

  const target = data.find((s) => s.id === id);
  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Rotation = active singers. The singing person stays put; the express
  // target slots in right after them.
  const rotation = data.filter((s) =>
    ["queued", "getting_closer", "on_deck", "singing"].includes(s.status),
  );

  const singingIdx = rotation.findIndex((s) => s.status === "singing");
  const others = rotation.filter((s) => s.id !== id && s.status !== "singing");

  const newOrder: Singer[] = [];
  if (singingIdx >= 0) newOrder.push(rotation[singingIdx]);
  if (target.status !== "singing") newOrder.push(target);
  newOrder.push(...others);

  await Promise.all(
    newOrder.map((s, idx) =>
      db.from("singers").update({ queue_position: idx + 1 }).eq("id", s.id),
    ),
  );

  await compactPositions();
  await reconcileStatuses();
  return NextResponse.json({ ok: true });
}
