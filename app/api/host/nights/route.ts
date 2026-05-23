import { NextResponse } from "next/server";
import { db, type Night } from "@/lib/supabase";
import { isHostAuthed } from "@/lib/host-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isHostAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await db
    .from("nights")
    .select("*")
    .order("ended_at", { ascending: false })
    .returns<Night[]>();

  if (error) {
    console.error("nights fetch failed", error);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }

  return NextResponse.json(
    { nights: data ?? [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
