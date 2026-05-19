import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { isHostAuthed } from "@/lib/host-auth";

export async function POST(req: Request) {
  if (!(await isHostAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id, notes } = (await req.json().catch(() => ({}))) as {
    id?: string;
    notes?: string;
  };
  if (!id || typeof notes !== "string") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { error } = await db
    .from("singers")
    .update({ notes: notes.slice(0, 500) })
    .eq("id", id);

  if (error) {
    console.error("notes update failed", error);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
