import { notFound } from "next/navigation";
import { db, toPublicSinger, type Singer } from "@/lib/supabase";
import StatusView from "./status-view";

export default async function SingerStatus({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data, error } = await db
    .from("singers")
    .select("*")
    .eq("id", id)
    .maybeSingle<Singer>();

  if (error) {
    console.error("status page fetch failed", error);
    throw new Error("Failed to load");
  }
  if (!data) {
    notFound();
  }

  return <StatusView initial={toPublicSinger(data)} />;
}
