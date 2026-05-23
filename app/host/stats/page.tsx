import Link from "next/link";
import { db, type Night } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatMins(mins: number | null): string {
  if (mins === null) return "—";
  return `${mins.toFixed(1)} min`;
}

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

  // Records — only meaningful with multiple completed nights.
  const recordBiggest = nights.reduce<Night | null>(
    (best, n) =>
      best === null || n.total_signups > best.total_signups ? n : best,
    null,
  );
  const sungOnly = nights.filter((n) => n.total_sung > 0 && n.mins_per_singer !== null);
  const recordFastest = sungOnly.reduce<Night | null>(
    (best, n) =>
      best === null || (n.mins_per_singer ?? Infinity) < (best.mins_per_singer ?? Infinity)
        ? n
        : best,
    null,
  );

  const totalAllTimeSignups = nights.reduce((sum, n) => sum + n.total_signups, 0);
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

      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        {nights.length === 0 ? (
          <p className="text-zinc-500 text-center py-12">
            No archived nights yet. Hit <span className="text-emerald-400">End the night</span> on
            the dashboard to lock in tonight's stats.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-4">
                <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">
                  ⭐ Biggest night
                </p>
                {recordBiggest ? (
                  <>
                    <p className="text-2xl font-bold">{recordBiggest.total_signups}</p>
                    <p className="text-xs text-zinc-400 mt-1">
                      {formatDate(recordBiggest.ended_at)}
                    </p>
                  </>
                ) : (
                  <p className="text-zinc-500">—</p>
                )}
              </div>

              <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-4">
                <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">
                  ⚡ Fastest pace
                </p>
                {recordFastest ? (
                  <>
                    <p className="text-2xl font-bold">
                      {formatMins(recordFastest.mins_per_singer)}
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                      per singer · {formatDate(recordFastest.ended_at)}
                    </p>
                  </>
                ) : (
                  <p className="text-zinc-500">—</p>
                )}
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900 text-zinc-400">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Night</th>
                    <th className="text-right px-3 py-2 font-medium">Signups</th>
                    <th className="text-right px-3 py-2 font-medium">Sung</th>
                    <th className="text-right px-3 py-2 font-medium">Duration</th>
                    <th className="text-right px-3 py-2 font-medium">Min / singer</th>
                  </tr>
                </thead>
                <tbody>
                  {nights.map((n) => {
                    const isBiggest = n.id === recordBiggest?.id;
                    const isFastest = n.id === recordFastest?.id;
                    return (
                      <tr
                        key={n.id}
                        className="border-t border-zinc-800 hover:bg-zinc-900/50"
                      >
                        <td className="px-3 py-2">
                          <div className="font-medium">
                            {n.name ?? formatDate(n.ended_at)}
                          </div>
                          {n.started_at && (
                            <div className="text-xs text-zinc-500 mt-0.5">
                              {new Date(n.started_at).toLocaleTimeString(undefined, {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                              {" → "}
                              {new Date(n.ended_at).toLocaleTimeString(undefined, {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </div>
                          )}
                        </td>
                        <td className="text-right px-3 py-2">
                          {n.total_signups}
                          {isBiggest && <span className="ml-1">⭐</span>}
                        </td>
                        <td className="text-right px-3 py-2 text-zinc-400">{n.total_sung}</td>
                        <td className="text-right px-3 py-2 text-zinc-400">
                          {formatDuration(n.duration_seconds)}
                        </td>
                        <td className="text-right px-3 py-2">
                          {formatMins(n.mins_per_singer)}
                          {isFastest && <span className="ml-1">⚡</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
