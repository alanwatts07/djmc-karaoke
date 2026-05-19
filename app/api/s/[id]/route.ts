import { NextResponse } from "next/server";
import { db, toPublicSinger, type Singer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { data, error } = await db
    .from("singers")
    .select("*")
    .eq("id", id)
    .maybeSingle<Singer>();

  if (error) {
    console.error("singer fetch failed", error);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(toPublicSinger(data), {
    headers: { "Cache-Control": "no-store" },
  });
}
