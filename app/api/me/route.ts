import { NextResponse } from "next/server";
import {
  db,
  toPublicSinger,
  type Night,
  type PublicNight,
  type Singer,
} from "@/lib/supabase";
import { getSingerToken } from "@/lib/singer-token";
import { isSessionOpen } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = await getSingerToken();
  const sessionOpen = await isSessionOpen();

  if (!token) {
    return NextResponse.json(
      { songs: [], nights: [], sessionOpen },
      { headers: { "Cache-Control": "no-store" } },
    );
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

  const songs = (data ?? []).map(toPublicSinger);

  // Fetch the names/dates of every night these songs belong to so the
  // client can group them by night with friendly labels.
  const nightIds = [...new Set(songs.map((s) => s.night_id).filter(Boolean))] as string[];
  let nights: PublicNight[] = [];
  if (nightIds.length > 0) {
    const { data: nightRows } = await db
      .from("nights")
      .select("id, name, ended_at")
      .in("id", nightIds)
      .returns<Night[]>();
    nights = (nightRows ?? []).map((n) => ({
      id: n.id,
      name: n.name,
      ended_at: n.ended_at,
    }));
  }

  return NextResponse.json(
    { songs, nights, sessionOpen },
    { headers: { "Cache-Control": "no-store" } },
  );
}
