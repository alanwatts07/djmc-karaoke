import { db, type Singer } from "@/lib/supabase";
import HostDashboard from "./dashboard";

export const dynamic = "force-dynamic";

export default async function HostPage() {
  const { data, error } = await db
    .from("singers")
    .select("*")
    .order("queue_position", { ascending: true })
    .returns<Singer[]>();

  if (error) {
    return (
      <main className="flex-1 p-6 bg-zinc-950 text-zinc-100">
        <p>Failed to load queue: {error.message}</p>
      </main>
    );
  }

  return <HostDashboard initial={data ?? []} />;
}
