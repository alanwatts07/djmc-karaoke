import { redirect } from "next/navigation";
import {
  db,
  toPublicSinger,
  type Night,
  type PublicNight,
  type Singer,
} from "@/lib/supabase";
import { getSingerToken } from "@/lib/singer-token";
import { isSessionOpen } from "@/lib/session";
import SongsView from "./songs-view";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const token = await getSingerToken();
  if (!token) {
    redirect("/");
  }

  const { data, error } = await db
    .from("singers")
    .select("*")
    .eq("singer_token", token)
    .order("submitted_at", { ascending: true })
    .returns<Singer[]>();

  if (error) {
    throw new Error("Failed to load your songs");
  }
  if (!data || data.length === 0) {
    redirect("/");
  }

  const songs = data.map(toPublicSinger);

  const nightIds = [
    ...new Set(songs.map((s) => s.night_id).filter(Boolean)),
  ] as string[];
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

  const sessionOpen = await isSessionOpen();

  return (
    <SongsView
      initialSongs={songs}
      initialNights={nights}
      initialSessionOpen={sessionOpen}
    />
  );
}
