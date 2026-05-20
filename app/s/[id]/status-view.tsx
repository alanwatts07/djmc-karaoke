"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PublicSinger } from "@/lib/supabase";
import { publicTierLabel, publicTierSubtext } from "@/lib/tiers";
import Footer from "../../footer";

const POLL_MS = 5000;

const TIER_BG: Record<PublicSinger["status"], string> = {
  queued: "from-purple-950 via-fuchsia-900 to-black",
  getting_closer: "from-purple-950 via-fuchsia-900 to-black",
  on_deck: "from-purple-950 via-fuchsia-900 to-black",
  hold: "from-purple-950 via-fuchsia-900 to-black",
  singing: "from-rose-500 via-pink-600 to-fuchsia-800",
  done: "from-emerald-700 via-emerald-900 to-black",
};

export default function StatusView({ initial }: { initial: PublicSinger }) {
  const [singer, setSinger] = useState<PublicSinger>(initial);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/s/${initial.id}`, { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as PublicSinger;
        if (!cancelled) setSinger(next);
      } catch {
        // network blip, try again next tick
      }
    };
    const handle = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [initial.id]);

  const label = publicTierLabel(singer.status);
  const subtext = publicTierSubtext(singer.status);
  const bg = TIER_BG[singer.status];

  return (
    <main
      className={`flex-1 flex flex-col items-center justify-center p-6 text-white bg-gradient-to-b ${bg} transition-colors duration-700`}
    >
      <div className="w-full max-w-sm text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-white/70 mb-2">
          {singer.stage_name}
        </p>
        <p className="text-white/60 italic mb-10">{singer.song}</p>

        <h1 className="text-5xl font-bold tracking-tight mb-4">{label}</h1>
        <p className="text-white/80 text-lg leading-relaxed">{subtext}</p>

        <Link
          href="/"
          className="block mt-10 w-full text-center rounded-lg bg-white/95 hover:bg-white text-purple-900 font-semibold py-3 transition"
        >
          Sing another song
        </Link>

        <p className="mt-6 text-xs text-white/50">
          Keep this page open. It updates on its own.
        </p>

        <Footer singerName={singer.stage_name} />
      </div>
    </main>
  );
}
