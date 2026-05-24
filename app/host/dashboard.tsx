"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Singer, SingerStatus } from "@/lib/supabase";

const POLL_MS = 4000;

const STATUS_COLORS: Record<SingerStatus, string> = {
  queued: "bg-zinc-700 text-zinc-100",
  getting_closer: "bg-indigo-600 text-white",
  on_deck: "bg-fuchsia-600 text-white",
  singing: "bg-rose-500 text-white",
  done: "bg-emerald-700 text-white",
  hold: "bg-amber-700 text-white",
};

const STATUS_LABEL: Record<SingerStatus, string> = {
  queued: "Queued",
  getting_closer: "Getting closer",
  on_deck: "On deck",
  singing: "Singing",
  done: "Done",
  hold: "Hold",
};

async function api(path: string, body?: unknown): Promise<boolean> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.ok;
}

type Density = "compact" | "medium" | "large";
const DENSITY_STORAGE_KEY = "karaoke_density";

// Density presets. Compact is a read-only one-liner (no drag handle, no
// action buttons) — for scanning the whole queue at a glance. Switch to
// medium/large when you actually want to act on a singer.
const DENSITY_CLASSES: Record<
  Density,
  {
    rowPadding: string;
    nameText: string;
    songText: string;
    actionButton: string;
    badge: string;
    handle: string;
    handleIcon: string;
    actionsGap: string;
    actionsMargin: string;
  }
> = {
  // compact is rendered with a totally different layout (single line, no
  // buttons), so its values here are mostly placeholders.
  compact: {
    rowPadding: "py-1 px-2",
    nameText: "text-xs",
    songText: "text-xs",
    actionButton: "",
    badge: "text-[9px] px-1.5 py-0.5",
    handle: "",
    handleIcon: "",
    actionsGap: "",
    actionsMargin: "",
  },
  medium: {
    rowPadding: "py-1.5 pr-2",
    nameText: "text-sm",
    songText: "text-xs",
    actionButton: "text-[10px] px-1.5 py-0.5",
    badge: "text-[9px] px-1.5 py-0.5",
    handle: "px-2.5 min-w-[36px]",
    handleIcon: "text-sm",
    actionsGap: "gap-1",
    actionsMargin: "mt-1.5",
  },
  large: {
    rowPadding: "py-3 pr-3",
    nameText: "text-base",
    songText: "text-sm",
    actionButton: "text-xs px-2.5 py-1",
    badge: "text-xs px-2 py-0.5",
    handle: "px-4 min-w-[44px]",
    handleIcon: "text-lg",
    actionsGap: "gap-1.5",
    actionsMargin: "mt-3",
  },
};

export default function HostDashboard({
  initial,
  initialSessionOpen,
}: {
  initial: Singer[];
  initialSessionOpen: boolean;
}) {
  const [singers, setSingers] = useState<Singer[]>(initial);
  const [sessionOpen, setSessionOpen] = useState(initialSessionOpen);
  const [density, setDensity] = useState<Density>("medium");
  const dirtyRef = useRef(false); // local edits in flight; pause polling overwrites

  // Hydrate density preference from localStorage on first mount. Done in an
  // effect (rather than the useState initializer) so SSR + client agree on
  // the initial render and we avoid hydration mismatch warnings.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(DENSITY_STORAGE_KEY);
    if (saved === "compact" || saved === "medium" || saved === "large") {
      setDensity(saved);
    }
  }, []);

  function pickDensity(next: Density) {
    setDensity(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DENSITY_STORAGE_KEY, next);
    }
  }

  const sensors = useSensors(
    // Mouse: 6px of movement triggers drag — same as before.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Touch: press-and-hold 250ms (with <5px wobble allowed) before drag
    // engages. Means quick swipes still scroll the list cleanly; you have
    // to deliberately hold the handle to start a reorder.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (dirtyRef.current) return;
      try {
        const res = await fetch("/api/host/queue", { cache: "no-store" });
        if (!res.ok) return;
        const { singers } = (await res.json()) as { singers: Singer[] };
        if (!cancelled && !dirtyRef.current) setSingers(singers);
      } catch {
        // try next tick
      }
    };
    const handle = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, []);

  const ids = useMemo(() => singers.map((s) => s.id), [singers]);

  async function refetch() {
    const res = await fetch("/api/host/queue", { cache: "no-store" });
    if (!res.ok) return;
    const { singers } = (await res.json()) as { singers: Singer[] };
    setSingers(singers);
  }

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = singers.findIndex((s) => s.id === active.id);
    const newIdx = singers.findIndex((s) => s.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;

    const reordered = arrayMove(singers, oldIdx, newIdx);
    setSingers(reordered);
    dirtyRef.current = true;
    await api("/api/host/reorder", { order: reordered.map((s) => s.id) });
    dirtyRef.current = false;
    await refetch();
  }

  async function setStatus(id: string, status: SingerStatus) {
    dirtyRef.current = true;
    setSingers((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    await api("/api/host/status", { id, status });
    dirtyRef.current = false;
    await refetch();
  }

  async function express(id: string) {
    dirtyRef.current = true;
    await api("/api/host/express", { id });
    dirtyRef.current = false;
    await refetch();
  }

  async function remove(id: string) {
    if (!confirm("Remove this singer from the queue?")) return;
    dirtyRef.current = true;
    setSingers((prev) => prev.filter((s) => s.id !== id));
    await api("/api/host/delete", { id });
    dirtyRef.current = false;
    await refetch();
  }

  async function saveNotes(id: string, notes: string) {
    dirtyRef.current = true;
    setSingers((prev) => prev.map((s) => (s.id === id ? { ...s, notes } : s)));
    await api("/api/host/notes", { id, notes });
    dirtyRef.current = false;
  }

  async function addTip(id: string, amount: number) {
    dirtyRef.current = true;
    await api("/api/host/tip", { id, amount });
    dirtyRef.current = false;
    await refetch();
  }

  async function manualAdd(stage_name: string, song: string) {
    dirtyRef.current = true;
    await api("/api/host/add", { stage_name, song });
    dirtyRef.current = false;
    await refetch();
  }

  async function clearQueue(mode: "all" | "completed") {
    if (mode === "all") {
      const typed = prompt(
        `This will DELETE the entire queue (${singers.length} singer${singers.length === 1 ? "" : "s"}, including anyone currently singing). Type CLEAR to confirm.`,
      );
      if (typed?.trim().toUpperCase() !== "CLEAR") return;
    } else {
      const done = counts.done ?? 0;
      if (
        !confirm(
          `Hide ${done} completed singer${done === 1 ? "" : "s"} from the active dashboard? They stay in the database and get rolled into the night when you click End the night.`,
        )
      )
        return;
    }
    dirtyRef.current = true;
    await api("/api/host/clear", { mode });
    dirtyRef.current = false;
    await refetch();
  }

  // Realistic mix: 2 power singers with 3 songs each, 1 with 2, rest with 1.
  // Interleaved in a plausible arrival order so the rotation rebuilds in
  // an interesting way as each one drops.
  const TEST_SEED = [
    { stage_name: "[Test] Alice", song: "Wonderwall" },
    { stage_name: "[Test] Bob", song: "Mr. Brightside" },
    { stage_name: "[Test] Carol", song: "Toxic" },
    { stage_name: "[Test] Eve", song: "Africa" },
    { stage_name: "[Test] Bob", song: "Bohemian Rhapsody" },
    { stage_name: "[Test] Dan", song: "Hotel California" },
    { stage_name: "[Test] Eve", song: "Sweet Caroline" },
    { stage_name: "[Test] Alice", song: "Don't Stop Believin'" },
    { stage_name: "[Test] Bob", song: "Take On Me" },
    { stage_name: "[Test] Frank", song: "Livin' on a Prayer" },
    { stage_name: "[Test] Eve", song: "I Want It That Way" },
  ];
  const SEED_DELAY_MS = 1800;

  async function seedTest() {
    const total = TEST_SEED.length;
    if (
      !confirm(
        `Run live test: ${total} [Test] singers will be added one at a time over ~${Math.round((total * SEED_DELAY_MS) / 1000)}s so you can watch the rotation rearrange. Existing test rows clear first.`,
      )
    )
      return;

    dirtyRef.current = true;
    // Step 1: clear any prior test rows from a previous run.
    await api("/api/host/seed-test", {});
    await refetch();

    // Step 2: insert one at a time, refetch between, so the dashboard
    // visibly rearranges with each new singer.
    for (let i = 0; i < TEST_SEED.length; i++) {
      const ok = await api("/api/host/add", TEST_SEED[i]);
      if (!ok) {
        alert(`Seed failed at step ${i + 1}. Stopping.`);
        break;
      }
      await refetch();
      if (i < TEST_SEED.length - 1) {
        await new Promise((r) => setTimeout(r, SEED_DELAY_MS));
      }
    }
    dirtyRef.current = false;
  }

  async function beginNight() {
    dirtyRef.current = true;
    const ok = await api("/api/host/begin-night", {});
    dirtyRef.current = false;
    if (ok) setSessionOpen(true);
    else alert("Couldn't begin the night — try again.");
  }

  async function endNight() {
    const totalSung = counts.done ?? 0;
    const message =
      singers.length === 0
        ? `Close sign-ups? Sharing the link will show the promo page until you hit Begin again.`
        : `End the night and archive ${singers.length} singer${singers.length === 1 ? "" : "s"} (${totalSung} sung)? Stats will be locked in and the active queue cleared.`;
    if (!confirm(message)) return;
    dirtyRef.current = true;
    const ok = await api("/api/host/end-night", {});
    dirtyRef.current = false;
    if (ok) {
      setSessionOpen(false);
      await refetch();
      if (singers.length > 0) {
        alert("Night archived. See /host/stats for the recap.");
      }
    } else {
      alert("Couldn't end the night — try again or check the server logs.");
    }
  }

  async function editInfo(id: string, stage_name: string, song: string) {
    dirtyRef.current = true;
    setSingers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, stage_name, song } : s)),
    );
    await api("/api/host/edit-singer", { id, stage_name, song });
    dirtyRef.current = false;
    await refetch();
  }

  const counts = singers.reduce(
    (acc, s) => {
      acc[s.status] = (acc[s.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<SingerStatus, number>,
  );

  return (
    <main className="flex-1 bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-4 md:px-6 py-3 sticky top-0 bg-zinc-950/95 backdrop-blur z-10 space-y-2">
        {/* Row 1: title + status pill + sign out (always one line) */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-base md:text-xl font-semibold truncate">
              Host dashboard
            </h1>
            <span
              className={`shrink-0 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                sessionOpen
                  ? "bg-emerald-900/60 text-emerald-300 border border-emerald-700/60"
                  : "bg-zinc-800 text-zinc-400 border border-zinc-700"
              }`}
              title={sessionOpen ? "Public can submit" : "Public submissions blocked"}
            >
              {sessionOpen ? "● Live" : "○ Closed"}
            </span>
          </div>
          <form action="/api/host/logout" method="post" className="shrink-0">
            <button className="text-xs text-zinc-400 hover:text-zinc-200" type="submit">
              Sign out
            </button>
          </form>
        </div>

        {/* Row 2: stats line — can wrap on very narrow screens */}
        <p className="text-xs text-zinc-500">
          {(counts.queued ?? 0) + (counts.getting_closer ?? 0) + (counts.on_deck ?? 0)}{" "}
          up next &middot;{" "}
          {counts.singing ?? 0} singing &middot;{" "}
          {counts.hold ?? 0} hold &middot;{" "}
          <span className="text-emerald-500">{counts.done ?? 0} done</span>
        </p>

        {/* Row 3: action buttons — wrap freely */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded border border-zinc-800 overflow-hidden shrink-0"
            role="group"
            aria-label="Card size"
          >
            {(["compact", "medium", "large"] as Density[]).map((d) => (
              <button
                key={d}
                onClick={() => pickDensity(d)}
                aria-pressed={density === d}
                title={`${d[0].toUpperCase()}${d.slice(1)} card size`}
                className={`px-2 py-1 text-[10px] uppercase tracking-wider ${
                  density === d
                    ? "bg-zinc-700 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                {d === "compact" ? "S" : d === "medium" ? "M" : "L"}
              </button>
            ))}
          </div>
          <button
            onClick={() => clearQueue("completed")}
            disabled={!counts.done}
            className="text-xs px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Hide Done rows from the active dashboard. They stay in the DB and roll into the night when you click End the night."
          >
            Hide done
            {counts.done ? ` (${counts.done})` : ""}
          </button>
          {sessionOpen ? (
            <button
              onClick={endNight}
              className="text-xs px-2.5 py-1.5 rounded bg-rose-900 hover:bg-rose-800 text-rose-100 font-medium"
              title={
                singers.length === 0
                  ? "Stop accepting submissions"
                  : "Archive the night, lock in stats, clear active queue"
              }
            >
              ■ End the night
            </button>
          ) : (
            <button
              onClick={beginNight}
              className="text-xs px-2.5 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 font-medium"
              title="Open the link to public sign-ups"
            >
              ▶ Begin night
            </button>
          )}
          <Link
            href="/host/stats"
            className="text-xs px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700"
            title="See past nights and records"
          >
            Stats
          </Link>
        </div>
      </header>

      <div className="p-4 md:p-6 space-y-3 max-w-3xl mx-auto">
        <ManualAdd onAdd={manualAdd} />

        {singers.length === 0 && (
          <div className="text-zinc-500 text-center py-12 space-y-3">
            <p>Queue is empty. Send singers to the URL on the QR sign.</p>
            <button
              onClick={seedTest}
              className="text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400"
              title="Drop 8 fake [Test] singers in to play with the dashboard"
            >
              Seed test queue
            </button>
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {singers.map((singer) => (
              <SortableRow
                key={singer.id}
                singer={singer}
                density={density}
                onStatus={(s) => setStatus(singer.id, s)}
                onExpress={() => express(singer.id)}
                onRemove={() => remove(singer.id)}
                onNotes={(n) => saveNotes(singer.id, n)}
                onTip={(amt) => addTip(singer.id, amt)}
                onEditInfo={(name, song) => editInfo(singer.id, name, song)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </main>
  );
}

function ManualAdd({
  onAdd,
}: {
  onAdd: (stage_name: string, song: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [song, setSong] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !song.trim() || busy) return;
    setBusy(true);
    try {
      await onAdd(name.trim(), song.trim());
      setName("");
      setSong("");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full text-sm py-2 rounded border border-dashed border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:border-zinc-500"
      >
        + Add singer manually
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 space-y-2"
    >
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Stage name"
          maxLength={60}
          autoFocus
          className="flex-1 rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
        />
        <input
          value={song}
          onChange={(e) => setSong(e.target.value)}
          placeholder="Song"
          maxLength={120}
          className="flex-[1.5] rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setName("");
            setSong("");
          }}
          className="text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || !name.trim() || !song.trim()}
          className="text-xs px-3 py-1.5 rounded bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add to queue"}
        </button>
      </div>
    </form>
  );
}

function SortableRow({
  singer,
  density,
  onStatus,
  onExpress,
  onRemove,
  onNotes,
  onTip,
  onEditInfo,
}: {
  singer: Singer;
  density: Density;
  onStatus: (s: SingerStatus) => void;
  onExpress: () => void;
  onRemove: () => void;
  onNotes: (n: string) => void;
  onTip: (amt: number) => void;
  onEditInfo: (stage_name: string, song: string) => Promise<void>;
}) {
  const d = DENSITY_CLASSES[density];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: singer.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Haptic blip on touch devices when drag engages, so the host knows the
  // long-press registered before they start moving. No-op if the browser
  // doesn't expose vibrate (most desktops, iOS Safari without permission).
  useEffect(() => {
    if (isDragging && typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(10);
    }
  }, [isDragging]);

  const [notesOpen, setNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState(singer.notes ?? "");
  // Reset draft when the upstream note changes (e.g. another host edited it).
  // Derive-during-render avoids React 19's set-state-in-effect warning.
  const [lastSyncedNotes, setLastSyncedNotes] = useState(singer.notes);
  if (singer.notes !== lastSyncedNotes) {
    setLastSyncedNotes(singer.notes);
    setNotesDraft(singer.notes ?? "");
  }

  const [editOpen, setEditOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(singer.stage_name);
  const [songDraft, setSongDraft] = useState(singer.song);
  const [editBusy, setEditBusy] = useState(false);
  // Same derive-during-render pattern for name/song. Only re-sync while the
  // editor is closed so we don't clobber a draft the host is typing.
  const [lastSyncedName, setLastSyncedName] = useState(singer.stage_name);
  const [lastSyncedSong, setLastSyncedSong] = useState(singer.song);
  if (
    !editOpen &&
    (singer.stage_name !== lastSyncedName || singer.song !== lastSyncedSong)
  ) {
    setLastSyncedName(singer.stage_name);
    setLastSyncedSong(singer.song);
    setNameDraft(singer.stage_name);
    setSongDraft(singer.song);
  }

  async function saveEdit() {
    const name = nameDraft.trim();
    const song = songDraft.trim();
    if (!name || !song) return;
    if (name === singer.stage_name && song === singer.song) {
      setEditOpen(false);
      return;
    }
    setEditBusy(true);
    try {
      await onEditInfo(name, song);
      setEditOpen(false);
    } finally {
      setEditBusy(false);
    }
  }

  const isDone = singer.status === "done";
  const isHold = singer.status === "hold";

  // Compact mode: single-line read-only row. No drag, no actions. Lets
  // the host fit a much larger queue on screen for scanning. Switch to
  // medium/large to interact.
  if (density === "compact") {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={[
          "flex items-center gap-2 rounded border bg-zinc-900 border-zinc-800 py-1 px-2 transition-opacity",
          singer.status === "singing" ? "ring-1 ring-rose-500" : "",
          isDone ? "opacity-40 bg-zinc-950" : "",
          isHold ? "opacity-60" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span
          className={`text-xs font-semibold truncate min-w-0 flex-shrink-0 max-w-[40%] ${isDone ? "line-through text-zinc-500" : ""}`}
        >
          {singer.stage_name}
        </span>
        <span className="text-xs italic text-zinc-500 truncate flex-1 min-w-0">
          {singer.song}
        </span>
        <span
          className={`shrink-0 ${d.badge} rounded ${STATUS_COLORS[singer.status]}`}
        >
          {STATUS_LABEL[singer.status]}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "rounded-lg border bg-zinc-900 border-zinc-800 transition-opacity",
        singer.status === "singing" ? "ring-2 ring-rose-500" : "",
        isDone ? "opacity-40 bg-zinc-950" : "",
        isHold ? "opacity-60" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-stretch">
        <button
          {...attributes}
          {...listeners}
          aria-label="Press and hold to reorder"
          title="Press and hold (or click and drag on desktop) to reorder"
          className={[
            d.handle,
            "flex items-center justify-center",
            "cursor-grab active:cursor-grabbing touch-none select-none",
            "text-zinc-500 hover:text-zinc-200 active:text-fuchsia-400",
            "border-r border-zinc-800/60",
            isDragging ? "bg-fuchsia-900/40" : "hover:bg-zinc-800/60",
          ].join(" ")}
        >
          <span className={`${d.handleIcon} leading-none`}>⠿</span>
        </button>

        <div className={`flex-1 ${d.rowPadding}`}>
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p
                className={`font-semibold truncate ${d.nameText} ${isDone ? "line-through text-zinc-500" : ""}`}
              >
                {singer.stage_name}
              </p>
              <p className={`text-zinc-400 truncate italic ${d.songText}`}>
                {singer.song}
              </p>
            </div>
            <span className={`${d.badge} rounded ${STATUS_COLORS[singer.status]}`}>
              {STATUS_LABEL[singer.status]}
            </span>
          </div>

          <div className={`${d.actionsMargin} flex flex-wrap ${d.actionsGap}`}>
            <button
              onClick={onExpress}
              className={`${d.actionButton} rounded bg-fuchsia-600 hover:bg-fuchsia-500 font-medium`}
              title="Bump to the front of the queue (after current singer)"
            >
              Express Lane
            </button>
            <button
              onClick={() => onStatus("singing")}
              className={`${d.actionButton} rounded bg-rose-600 hover:bg-rose-500`}
            >
              Now singing
            </button>
            <button
              onClick={() => onStatus("done")}
              className={`${d.actionButton} rounded bg-emerald-700 hover:bg-emerald-600`}
            >
              Done
            </button>
            <button
              onClick={() => onStatus(singer.status === "hold" ? "queued" : "hold")}
              className={`${d.actionButton} rounded bg-amber-700 hover:bg-amber-600`}
            >
              {singer.status === "hold" ? "Resume" : "Hold"}
            </button>
            <button
              onClick={() => setEditOpen((o) => !o)}
              className={`${d.actionButton} rounded bg-zinc-800 hover:bg-zinc-700`}
              title="Edit name + song"
            >
              ✏️ Edit
            </button>
            <button
              onClick={() => setNotesOpen((o) => !o)}
              className={`${d.actionButton} rounded bg-zinc-800 hover:bg-zinc-700`}
            >
              Notes
              {singer.notes ? " •" : ""}
            </button>
            <button
              onClick={() => {
                const amt = prompt("Tip amount in dollars:", "5");
                const n = amt ? Number(amt) : NaN;
                if (Number.isFinite(n) && n !== 0) onTip(n);
              }}
              className={`${d.actionButton} rounded bg-zinc-800 hover:bg-zinc-700`}
              title={`Tip total: $${singer.tip_total}`}
            >
              Tip {singer.tip_total > 0 ? `$${singer.tip_total}` : ""}
            </button>
            <button
              onClick={onRemove}
              className={`${d.actionButton} rounded bg-zinc-800 hover:bg-rose-900 text-zinc-400 hover:text-rose-200 ml-auto`}
            >
              Remove
            </button>
          </div>

          {editOpen && (
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  placeholder="Stage name"
                  maxLength={60}
                  disabled={editBusy}
                  className="flex-1 text-sm rounded bg-zinc-950 border border-zinc-800 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                />
                <input
                  value={songDraft}
                  onChange={(e) => setSongDraft(e.target.value)}
                  placeholder="Song"
                  maxLength={120}
                  disabled={editBusy}
                  className="flex-[1.5] text-sm rounded bg-zinc-950 border border-zinc-800 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setEditOpen(false)}
                  disabled={editBusy}
                  className="text-xs px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={editBusy || !nameDraft.trim() || !songDraft.trim()}
                  className="text-xs px-3 py-1 rounded bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50"
                >
                  {editBusy ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          )}

          {notesOpen && (
            <div className="mt-3">
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                onBlur={() => {
                  if (notesDraft !== (singer.notes ?? "")) onNotes(notesDraft);
                }}
                rows={2}
                maxLength={500}
                placeholder="$20 tip, owner's friend, birthday…"
                className="w-full text-sm rounded bg-zinc-950 border border-zinc-800 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
