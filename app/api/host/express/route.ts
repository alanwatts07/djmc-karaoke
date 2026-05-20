import { NextResponse } from "next/server";
import { db, type Singer } from "@/lib/supabase";
import { isHostAuthed } from "@/lib/host-auth";
import { reconcileStatuses, setQueueOrder } from "@/lib/queue-ops";

// Bump a singer to the slot right after the currently-singing person (or to
// the top if nobody is singing). Other rotation singers slide down by one.
// Writes the whole queue order in one atomic RPC so the unique constraint
// on queue_position can't trip mid-renumber.
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

  const singing = data.filter((s) => s.status === "singing");
  const otherRotation = data.filter(
    (s) =>
      ["queued", "getting_closer", "on_deck"].includes(s.status) &&
      s.id !== id,
  );
  const hold = data.filter((s) => s.status === "hold");
  const done = data.filter((s) => s.status === "done");

  // Full bucket order with target spliced in right after the currently-singing
  // singer (or at the top if nobody is singing). If the target is the one
  // singing, it stays where it is.
  const newOrder: Singer[] = [];
  newOrder.push(...singing);
  if (target.status !== "singing") newOrder.push(target);
  newOrder.push(...otherRotation);
  newOrder.push(...hold);
  newOrder.push(...done);

  await setQueueOrder(newOrder.map((s) => s.id));
  await reconcileStatuses();
  return NextResponse.json({ ok: true });
}
