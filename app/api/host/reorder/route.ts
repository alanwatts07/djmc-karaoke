import { NextResponse } from "next/server";
import { isHostAuthed } from "@/lib/host-auth";
import { reconcileStatuses, setQueueOrder } from "@/lib/queue-ops";

// Body: { order: string[] }  — full id list in the new order. The order should
// include every singer id; positions are reassigned 1..N in that order.
export async function POST(req: Request) {
  if (!(await isHostAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { order?: string[] } | null;
  const order = body?.order;
  if (!Array.isArray(order) || order.some((id) => typeof id !== "string")) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  await setQueueOrder(order);
  await reconcileStatuses();
  return NextResponse.json({ ok: true });
}
