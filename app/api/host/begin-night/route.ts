import { NextResponse } from "next/server";
import { isHostAuthed } from "@/lib/host-auth";
import { setSessionOpen } from "@/lib/session";

export async function POST() {
  if (!(await isHostAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    await setSessionOpen(true);
  } catch (e) {
    console.error("begin-night failed", e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
