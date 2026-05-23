import Link from "next/link";
import { db, type Night } from "@/lib/supabase";
import NightsTable from "./nights-table";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const { data, error } = await db
    .from("nights")
    .select("*")
    .order("ended_at", { ascending: false })
    .returns<Night[]>();

  if (error) {
    return (
      <main className="flex-1 p-6 bg-zinc-950 text-zinc-100">
        <p className="text-rose-400">Failed to load stats: {error.message}</p>
      </main>
    );
  }

  const nights = data ?? [];
  const totalAllTimeSignups = nights.reduce(
    (sum, n) => sum + n.total_signups,
    0,
  );
  const totalAllTimeSung = nights.reduce((sum, n) => sum + n.total_sung, 0);

  return (
    <main className="flex-1 bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-4 md:px-6 py-3 flex items-center justify-between gap-3 sticky top-0 bg-zinc-950/95 backdrop-blur z-10">
        <div>
          <h1 className="text-lg md:text-xl font-semibold">Night stats</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {nights.length} night{nights.length === 1 ? "" : "s"} archived &middot;{" "}
            {totalAllTimeSignups} total signups &middot; {totalAllTimeSung} sung
          </p>
        </div>
        <Link
          href="/host"
          className="text-xs px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700"
        >
          ← Dashboard
        </Link>
      </header>

      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        {nights.length === 0 ? (
          <p className="text-zinc-500 text-center py-12">
            No archived nights yet. Hit{" "}
            <span className="text-emerald-400">End the night</span> on the
            dashboard to lock in tonight's stats.
          </p>
        ) : (
          <NightsTable initial={nights} />
        )}
      </div>
    </main>
  );
}
