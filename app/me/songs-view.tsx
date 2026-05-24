"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type {
  PublicSinger,
  PublicNight,
  SingerStatus,
} from "@/lib/supabase";
import { publicTierLabel, publicTierSubtext } from "@/lib/tiers";
import Footer from "../footer";

const POLL_MS = 5000;

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

function sortActiveSongs(songs: PublicSinger[]): PublicSinger[] {
  return [...songs].sort((a, b) => {
    const r = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (r !== 0) return r;
    return a.submitted_at.localeCompare(b.submitted_at);
  });
}

function formatNightLabel(n: PublicNight): string {
  if (n.name) return n.name;
  return new Date(n.ended_at).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function SetlistRow({
  song,
  onEdit,
  onDelete,
  onEnterEdit,
  onLeaveEdit,
  readOnly,
}: {
  song: PublicSinger;
  onEdit: (newSong: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onEnterEdit: () => void;
  onLeaveEdit: () => void;
  readOnly?: boolean;
}) {
  const isDone = song.status === "done";
  const isSinging = song.status === "singing";
  const canEdit = !readOnly && !isDone && !isSinging;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(song.song);
  const [busy, setBusy] = useState(false);

  function startEdit() {
    setDraft(song.song);
    setEditing(true);
    onEnterEdit();
  }
  function cancelEdit() {
    setDraft(song.song);
    setEditing(false);
    onLeaveEdit();
  }
  async function saveEdit() {
    const next = draft.trim();
    if (!next || next === song.song) {
      cancelEdit();
      return;
    }
    setBusy(true);
    try {
      await onEdit(next);
      setEditing(false);
      onLeaveEdit();
    } finally {
      setBusy(false);
    }
  }
  async function removeRow() {
    if (!confirm(`Remove "${song.song}" from your setlist?`)) return;
    setBusy(true);
    try {
      await onDelete();
      setEditing(false);
      onLeaveEdit();
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <li className="rounded-lg bg-black/40 ring-1 ring-white/20 p-3 space-y-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveEdit();
            if (e.key === "Escape") cancelEdit();
          }}
          maxLength={120}
          autoFocus
          disabled={busy}
          className="w-full rounded bg-black/50 border border-white/20 px-3 py-2 text-sm italic text-white focus:outline-none focus:border-white/60"
        />
        <div className="flex gap-2 text-xs">
          <button
            onClick={saveEdit}
            disabled={busy || !draft.trim()}
            className="flex-1 rounded bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 py-1.5 font-medium"
          >
            {busy ? "Saving…" : "Save"}
          </button>
          <button
            onClick={cancelEdit}
            disabled={busy}
            className="px-3 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={removeRow}
            disabled={busy}
            className="px-3 rounded bg-rose-900 hover:bg-rose-800 text-rose-100 disabled:opacity-50"
            title="Remove this song"
          >
            Delete
          </button>
        </div>
      </li>
    );
  }

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
      {canEdit && (
        <button
          onClick={startEdit}
          className="shrink-0 -mr-1 px-2 py-1 text-white/40 hover:text-white text-sm"
          aria-label="Edit song"
          title="Edit"
        >
          ✏️
        </button>
      )}
    </li>
  );
}

export default function SongsView({
  initialSongs,
  initialNights,
  initialSessionOpen,
}: {
  initialSongs: PublicSinger[];
  initialNights: PublicNight[];
  initialSessionOpen: boolean;
}) {
  const [songs, setSongs] = useState<PublicSinger[]>(initialSongs);
  const [nights, setNights] = useState<PublicNight[]>(initialNights);
  const [sessionOpen, setSessionOpen] = useState(initialSessionOpen);
  const editingRef = useRef(false);

  async function refetch() {
    const res = await fetch("/api/me", { cache: "no-store" });
    if (!res.ok) return;
    const body = (await res.json()) as {
      songs: PublicSinger[];
      nights: PublicNight[];
      sessionOpen: boolean;
    };
    setSongs(body.songs);
    setNights(body.nights);
    setSessionOpen(body.sessionOpen);
  }

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (editingRef.current) return;
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as {
          songs: PublicSinger[];
          nights: PublicNight[];
          sessionOpen: boolean;
        };
        if (!cancelled && !editingRef.current) {
          setSongs(body.songs);
          setNights(body.nights);
          setSessionOpen(body.sessionOpen);
        }
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

  async function editSong(id: string, song: string) {
    const res = await fetch("/api/me/edit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, song }),
    });
    if (!res.ok) {
      alert("Couldn't update that song. It may already be locked in.");
      return;
    }
    await refetch();
  }

  async function deleteSong(id: string) {
    const res = await fetch("/api/me/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      alert("Couldn't remove that song. It may already be locked in.");
      return;
    }
    await refetch();
  }

  // Split songs into active session (no night_id) and per-night history.
  const activeSongs = sortActiveSongs(songs.filter((s) => !s.night_id));
  const pastByNight = new Map<string, PublicSinger[]>();
  for (const s of songs) {
    if (!s.night_id) continue;
    const arr = pastByNight.get(s.night_id) ?? [];
    arr.push(s);
    pastByNight.set(s.night_id, arr);
  }

  // Sort past nights newest-first.
  const sortedPastNights = nights
    .filter((n) => pastByNight.has(n.id))
    .sort((a, b) => b.ended_at.localeCompare(a.ended_at));

  // Hero = top active song (if any), else most recent past song.
  const hero =
    activeSongs[0] ??
    songs.filter((s) => s.night_id).slice(-1)[0] ??
    songs[songs.length - 1];
  const name = hero?.stage_name ?? "";

  const activeDoneCount = activeSongs.filter((s) => s.status === "done").length;
  const activeUpcomingCount = activeSongs.length - activeDoneCount;
  const totalPastSongs = songs.length - activeSongs.length;

  return (
    <main
      className={`flex-1 flex flex-col items-center p-6 text-white bg-gradient-to-b ${TIER_BG[hero?.status ?? "queued"]} transition-colors duration-700`}
    >
      <div className="w-full max-w-sm flex-1 flex flex-col">
        <p className="text-sm uppercase tracking-[0.2em] text-white/70 mb-1 text-center mt-4">
          {name}
        </p>

        {hero && activeSongs.length > 0 && (
          <div className="text-center mt-4">
            <h1 className="text-5xl font-bold tracking-tight mb-3">
              {publicTierLabel(hero.status)}
            </h1>
            <p className="text-white/80 text-base leading-relaxed">
              {publicTierSubtext(hero.status)}
            </p>
          </div>
        )}

        {activeSongs.length === 0 && totalPastSongs > 0 && (
          <div className="text-center mt-4">
            <h1 className="text-4xl font-bold tracking-tight mb-3">
              Welcome back
            </h1>
            <p className="text-white/80 text-base leading-relaxed">
              No songs queued right now.{" "}
              {sessionOpen
                ? "Tap below to add one."
                : "We'll be open again soon."}
            </p>
          </div>
        )}

        {/* Active session block */}
        {activeSongs.length > 0 && (
          <div className="mt-8">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-xs uppercase tracking-widest text-white/50">
                Tonight
              </p>
              <p className="text-xs text-white/40">
                {activeDoneCount > 0 && `${activeDoneCount} sung`}
                {activeDoneCount > 0 && activeUpcomingCount > 0 && " · "}
                {activeUpcomingCount > 0 && `${activeUpcomingCount} to go`}
              </p>
            </div>
            <ul className="space-y-1.5">
              {activeSongs.map((s) => (
                <SetlistRow
                  key={s.id}
                  song={s}
                  onEdit={(next) => editSong(s.id, next)}
                  onDelete={() => deleteSong(s.id)}
                  onEnterEdit={() => {
                    editingRef.current = true;
                  }}
                  onLeaveEdit={() => {
                    editingRef.current = false;
                  }}
                />
              ))}
            </ul>
          </div>
        )}

        {/* Past nights — read-only, locked rows */}
        {sortedPastNights.map((n) => {
          const nightSongs = pastByNight.get(n.id) ?? [];
          return (
            <div key={n.id} className="mt-8">
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-xs uppercase tracking-widest text-white/50">
                  {formatNightLabel(n)}
                </p>
                <p className="text-xs text-white/40">
                  {nightSongs.length} song{nightSongs.length === 1 ? "" : "s"}
                </p>
              </div>
              <ul className="space-y-1.5">
                {nightSongs.map((s) => (
                  <SetlistRow
                    key={s.id}
                    song={s}
                    onEdit={async () => {}}
                    onDelete={async () => {}}
                    onEnterEdit={() => {}}
                    onLeaveEdit={() => {}}
                    readOnly
                  />
                ))}
              </ul>
            </div>
          );
        })}

        <div className="mt-8 flex flex-col items-center gap-2">
          {sessionOpen ? (
            <Link
              href="/?add=1"
              className="w-full text-center rounded-lg bg-white text-purple-900 hover:bg-purple-100 font-semibold text-lg py-3 transition"
            >
              + Add another song
            </Link>
          ) : (
            <div className="w-full text-center rounded-lg bg-white/10 text-white/60 font-semibold text-base py-3 cursor-not-allowed">
              Sign-ups closed — check back later
            </div>
          )}
          <p className="text-xs text-white/50 mt-2">
            Keep this page open — it updates on its own.
          </p>
        </div>

        <Footer singerName={name} />
      </div>
    </main>
  );
}
