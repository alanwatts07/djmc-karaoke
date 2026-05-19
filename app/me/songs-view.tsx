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

function SetlistRow({ song }: { song: PublicSinger }) {
  const isDone = song.status === "done";
  const isSinging = song.status === "singing";

  // Three visual states only, matching the blind queue:
  //   ✓ done    — green check, strikethrough
  //   ▶ singing — bright accent, larger
  //   ○ coming  — open circle, neutral
  const marker = isDone ? "✓" : isSinging ? "▶" : "○";

  return (
    <li
      className={[
        "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
        isDone
          ? "bg-black/20 text-white/40 line-through"
          : isSinging
            ? "bg-white/15 text-white ring-1 ring-white/40 font-semibold"
            : "bg-black/30 text-white/85",
      ].join(" ")}
    >
      <span
        className={[
          "shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full text-sm font-bold",
          isDone
            ? "bg-emerald-500/30 text-emerald-300"
            : isSinging
              ? "bg-white text-rose-700"
              : "border border-white/30 text-white/60",
        ].join(" ")}
        aria-hidden
      >
        {marker}
      </span>
      <span className="flex-1 truncate italic">{song.song}</span>
      {isSinging && (
        <span className="shrink-0 text-xs uppercase tracking-wider text-white/80">
          Now
        </span>
      )}
    </li>
  );
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

  const doneCount = songs.filter((s) => s.status === "done").length;
  const upcomingCount = songs.length - doneCount;

  return (
    <main
      className={`flex-1 flex flex-col items-center p-6 text-white bg-gradient-to-b ${TIER_BG[hero?.status ?? "queued"]} transition-colors duration-700`}
    >
      <div className="w-full max-w-sm flex-1 flex flex-col">
        <p className="text-sm uppercase tracking-[0.2em] text-white/70 mb-1 text-center mt-4">
          {name}
        </p>

        {hero && (
          <div className="text-center mt-4">
            <h1 className="text-5xl font-bold tracking-tight mb-3">
              {publicTierLabel(hero.status)}
            </h1>
            <p className="text-white/80 text-base leading-relaxed">
              {publicTierSubtext(hero.status)}
            </p>
          </div>
        )}

        <div className="mt-8">
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-xs uppercase tracking-widest text-white/50">
              Your setlist
            </p>
            <p className="text-xs text-white/40">
              {doneCount > 0 && `${doneCount} sung`}
              {doneCount > 0 && upcomingCount > 0 && " · "}
              {upcomingCount > 0 && `${upcomingCount} to go`}
            </p>
          </div>

          <ul className="space-y-1.5">
            {songs.map((s) => (
              <SetlistRow key={s.id} song={s} />
            ))}
          </ul>
        </div>

        <div className="mt-8 flex flex-col items-center gap-2">
          <Link
            href="/"
            className="w-full text-center rounded-lg bg-white text-purple-900 hover:bg-purple-100 font-semibold text-lg py-3 transition"
          >
            + Add another song
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
