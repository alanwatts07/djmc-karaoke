import { db, type Singer } from "@/lib/supabase";
import { isSessionOpen } from "@/lib/session";
import HostDashboard from "./dashboard";

export const dynamic = "force-dynamic";

export default async function HostPage() {
  const [{ data, error }, sessionOpen] = await Promise.all([
    db
      .from("singers")
      .select("*")
      .is("night_id", null)
      .is("archived_at", null)
      .order("queue_position", { ascending: true })
      .returns<Singer[]>(),
    isSessionOpen(),
  ]);

  if (error) {
    return (
      <main className="flex-1 p-6 bg-zinc-950 text-zinc-100">
        <p>Failed to load queue: {error.message}</p>
      </main>
    );
  }

  return (
    <HostDashboard initial={data ?? []} initialSessionOpen={sessionOpen} />
  );
}
