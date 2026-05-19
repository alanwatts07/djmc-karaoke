import { NextResponse } from "next/server";
import { db, toPublicSinger, type Singer } from "@/lib/supabase";
import { getSingerToken } from "@/lib/singer-token";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = await getSingerToken();
  if (!token) {
    return NextResponse.json({ songs: [] }, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const { data, error } = await db
    .from("singers")
    .select("*")
    .eq("singer_token", token)
    .order("submitted_at", { ascending: true })
    .returns<Singer[]>();

  if (error) {
    console.error("me fetch failed", error);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }

  return NextResponse.json(
    { songs: (data ?? []).map(toPublicSinger) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
