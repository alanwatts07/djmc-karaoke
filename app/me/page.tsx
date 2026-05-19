import { redirect } from "next/navigation";
import { db, toPublicSinger, type Singer } from "@/lib/supabase";
import { getSingerToken } from "@/lib/singer-token";
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

  return <SongsView initial={data.map(toPublicSinger)} />;
}
