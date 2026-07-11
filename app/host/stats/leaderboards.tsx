"use client";

import { useMemo, useState } from "react";
import type { SingerStat, SongStat } from "@/lib/stats/aggregate";

type Tab = "singers" | "songs";
const DEFAULT_SHOWN = 20;

export default function Leaderboards({
  singers,
  songs,
  totalPerformances,
}: {
  singers: SingerStat[];
  songs: SongStat[];
  totalPerformances: number;
}) {
  const [tab, setTab] = useState<Tab>("singers");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const q = query.trim().toLowerCase();

  const filteredSingers = useMemo(
    () =>
      q
        ? singers.filter(
            (s) =>
              s.name.toLowerCase().includes(q) ||
              s.songs.some((x) => x.title.toLowerCase().includes(q)),
          )
        : singers,
    [singers, q],
  );
  const filteredSongs = useMemo(
    () =>
      q
        ? songs.filter(
            (s) =>
              s.title.toLowerCase().includes(q) ||
              s.singers.some((x) => x.name.toLowerCase().includes(q)),
          )
        : songs,
    [songs, q],
  );

  const list = tab === "singers" ? filteredSingers : filteredSongs;
  const shown = showAll || q ? list : list.slice(0, DEFAULT_SHOWN);

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="text-lg font-semibold">All-time leaderboards</h2>
        <p className="text-xs text-zinc-500">
          {totalPerformances} performances · {singers.length} singers ·{" "}
          {songs.length} songs
        </p>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="inline-flex rounded-lg bg-zinc-900 border border-zinc-800 p-0.5">
          <TabButton active={tab === "singers"} onClick={() => setTab("singers")}>
            🎤 Singers
          </TabButton>
          <TabButton active={tab === "songs"} onClick={() => setTab("songs")}>
            🎵 Songs
          </TabButton>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search names or songs…"
          className="flex-1 min-w-[180px] rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-zinc-400">
            {tab === "singers" ? (
              <tr>
                <th className="text-left px-3 py-2 font-medium w-8">#</th>
                <th className="text-left px-3 py-2 font-medium">Singer</th>
                <th className="text-right px-3 py-2 font-medium">Songs sung</th>
                <th className="text-right px-3 py-2 font-medium">Nights</th>
              </tr>
            ) : (
              <tr>
                <th className="text-left px-3 py-2 font-medium w-8">#</th>
                <th className="text-left px-3 py-2 font-medium">Song</th>
                <th className="text-right px-3 py-2 font-medium">Times sung</th>
              </tr>
            )}
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                  No matches.
                </td>
              </tr>
            )}

            {tab === "singers" &&
              (shown as SingerStat[]).map((s, i) => {
                const isOpen = expanded === s.name;
                return (
                  <FragmentRow key={s.name}>
                    <tr
                      className="border-t border-zinc-800 hover:bg-zinc-900/50 cursor-pointer"
                      onClick={() => setExpanded(isOpen ? null : s.name)}
                    >
                      <td className="px-3 py-2 text-zinc-500">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">
                        {s.name}
                        <span className="ml-2 text-xs text-zinc-500">
                          {isOpen ? "▲" : "▾"}
                        </span>
                      </td>
                      <td className="text-right px-3 py-2">{s.sung}</td>
                      <td className="text-right px-3 py-2 text-zinc-400">
                        {s.nights}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-t border-zinc-800/50 bg-zinc-950">
                        <td></td>
                        <td colSpan={3} className="px-3 py-2">
                          <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">
                            Repertoire
                          </p>
                          <ul className="text-xs text-zinc-300 space-y-0.5">
                            {s.songs.map((song) => (
                              <li key={song.title}>
                                {song.title}
                                {song.count > 1 && (
                                  <span className="text-zinc-500">
                                    {" "}
                                    ×{song.count}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </FragmentRow>
                );
              })}

            {tab === "songs" &&
              (shown as SongStat[]).map((s, i) => {
                const isOpen = expanded === s.title;
                return (
                  <FragmentRow key={s.title}>
                    <tr
                      className="border-t border-zinc-800 hover:bg-zinc-900/50 cursor-pointer"
                      onClick={() => setExpanded(isOpen ? null : s.title)}
                    >
                      <td className="px-3 py-2 text-zinc-500">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">
                        {s.title}
                        <span className="ml-2 text-xs text-zinc-500">
                          {isOpen ? "▲" : "▾"}
                        </span>
                      </td>
                      <td className="text-right px-3 py-2">{s.timesSung}</td>
                    </tr>
                    {isOpen && (
                      <tr className="border-t border-zinc-800/50 bg-zinc-950">
                        <td></td>
                        <td colSpan={2} className="px-3 py-2">
                          <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">
                            Sung by
                          </p>
                          <p className="text-xs text-zinc-300">
                            {s.singers
                              .map(
                                (x) =>
                                  x.name +
                                  (x.count > 1 ? ` ×${x.count}` : ""),
                              )
                              .join(", ")}
                          </p>
                        </td>
                      </tr>
                    )}
                  </FragmentRow>
                );
              })}
          </tbody>
        </table>
      </div>

      {!q && list.length > DEFAULT_SHOWN && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
        >
          {showAll ? "Show top 20" : `Show all ${list.length}`}
        </button>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        active
          ? "bg-fuchsia-600 text-white"
          : "text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}

// Small helper so each row can render an optional expansion row as siblings.
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
