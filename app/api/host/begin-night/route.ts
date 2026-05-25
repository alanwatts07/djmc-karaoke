import { NextResponse } from "next/server";
import { isHostAuthed } from "@/lib/host-auth";
import { setSessionOpen } from "@/lib/session";

export async function POST(req: Request) {
  if (!(await isHostAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { venue } = (await req.json().catch(() => ({}))) as {
    venue?: string | null;
  };

  // Trim, treat empty as "leave previous venue alone" so the host doesn't
  // lose their last-used venue if they accidentally hit OK on the prompt
  // without typing.
  const trimmed = venue?.trim() || undefined;

  try {
    await setSessionOpen(true, trimmed && trimmed.length > 0 ? trimmed : undefined);
  } catch (e) {
    console.error("begin-night failed", e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
