"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PublicSinger, SingerStatus } from "@/lib/supabase";
import { publicTierLabel, publicTierSubtext } from "@/lib/tiers";
import Footer from "../footer";

const POLL_MS = 2500;

// Only "singing" and "done" get distinct visuals; everything else is the
// same neutral background so the singer can't read their position off the
// color of the screen.
const TIER_BG: Record<SingerStatus, string> = {
  queued: "from-purple-950 via-fuchsia-900 to-black",
  getting_closer: "from-purple-950 via-fuchsia-900 to-black",
  on_deck: "from-purple-950 via-fuchsia-900 to-black",
  hold: "from-purple-950 via-fuchsia-900 to-black",
  singing: "from-rose-500 via-pink-600 to-fuchsia-800",
  done: "from-emerald-700 via-emerald-900 to-black",
};

// Order: active songs first (singing, on_deck, getting_closer, queued, hold),
// then completed. Within each bucket, oldest submission first.
const STATUS_RANK: Record<SingerStatus, number> = {
  singing: 0,
  on_deck: 1,
  getting_closer: 2,
  queued: 3,
  hold: 4,
  done: 5,
};

function sortSongs(songs: PublicSinger[]): PublicSinger[] {
  return [...songs].sort((a, b) => {
    const r = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (r !== 0) return r;
    return a.submitted_at.localeCompare(b.submitted_at);
  });
}

export default function SongsView({ initial }: { initial: PublicSinger[] }) {
  const [songs, setSongs] = useState<PublicSinger[]>(sortSongs(initial));

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (!res.ok) return;
        const { songs: next } = (await res.json()) as { songs: PublicSinger[] };
        if (!cancelled) setSongs(sortSongs(next));
      } catch {
        // network blip
      }
    };
    const handle = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, []);

  // Hero tier = highest-priority active song (or the most-recent done).
  const hero = songs[0];
  const name = hero?.stage_name ?? "";

  return (
    <main
      className={`flex-1 flex flex-col items-center p-6 text-white bg-gradient-to-b ${TIER_BG[hero?.status ?? "queued"]} transition-colors duration-700`}
    >
      <div className="w-full max-w-sm flex-1 flex flex-col justify-center">
        <p className="text-sm uppercase tracking-[0.2em] text-white/70 mb-1 text-center">
          {name}
        </p>

        {hero && (
          <div className="text-center mt-4">
            <p className="text-white/60 italic mb-6">{hero.song}</p>
            <h1 className="text-5xl font-bold tracking-tight mb-3">
              {publicTierLabel(hero.status)}
            </h1>
            <p className="text-white/80 text-lg leading-relaxed">
              {publicTierSubtext(hero.status)}
            </p>
          </div>
        )}

        {songs.length > 1 && (
          <div className="mt-10">
            <p className="text-xs uppercase tracking-widest text-white/50 mb-2 text-center">
              Your other songs
            </p>
            <ul className="space-y-1.5">
              {songs.slice(1).map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-black/30 px-3 py-2 text-sm"
                >
                  <span className="truncate italic text-white/80">{s.song}</span>
                  <span className="shrink-0 text-xs px-2 py-0.5 rounded bg-white/10">
                    {publicTierLabel(s.status)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-10 flex flex-col items-center gap-2">
          <Link
            href="/"
            className="w-full text-center rounded-lg bg-white text-purple-900 hover:bg-purple-100 font-semibold text-lg py-3 transition"
          >
            Sing another song
          </Link>
          <p className="text-xs text-white/50 mt-2">
            Keep this page open — it updates on its own.
          </p>
        </div>

        <Footer singerName={name} />
      </div>
    </main>
  );
}
