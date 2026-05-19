import { NextResponse } from "next/server";
import { db, type Singer } from "@/lib/supabase";
import { isHostAuthed } from "@/lib/host-auth";

// Add a tip amount (in dollars, integer) to a singer's tip_total.
export async function POST(req: Request) {
  if (!(await isHostAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id, amount } = (await req.json().catch(() => ({}))) as {
    id?: string;
    amount?: number;
  };
  if (!id || typeof amount !== "number" || !Number.isFinite(amount)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { data: current, error: readErr } = await db
    .from("singers")
    .select("tip_total")
    .eq("id", id)
    .maybeSingle<Pick<Singer, "tip_total">>();
  if (readErr || !current) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const newTotal = Math.max(0, Math.round(current.tip_total + amount));
  const { error } = await db
    .from("singers")
    .update({ tip_total: newTotal })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, tip_total: newTotal });
}
