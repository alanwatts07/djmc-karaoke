"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
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

export default function HostDashboard({ initial }: { initial: Singer[] }) {
  const [singers, setSingers] = useState<Singer[]>(initial);
  const dirtyRef = useRef(false); // local edits in flight; pause polling overwrites

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
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
          `Archive ${done} completed singer${done === 1 ? "" : "s"}? Active singers stay put.`,
        )
      )
        return;
    }
    dirtyRef.current = true;
    await api("/api/host/clear", { mode });
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
      <header className="border-b border-zinc-800 px-4 md:px-6 py-3 flex items-center justify-between gap-3 sticky top-0 bg-zinc-950/95 backdrop-blur z-10">
        <div className="min-w-0">
          <h1 className="text-lg md:text-xl font-semibold">Host dashboard</h1>
          <p className="text-xs text-zinc-500 mt-0.5 truncate">
            {(counts.queued ?? 0) + (counts.getting_closer ?? 0) + (counts.on_deck ?? 0)}{" "}
            up next &middot;{" "}
            {counts.singing ?? 0} singing &middot;{" "}
            {counts.hold ?? 0} hold &middot;{" "}
            <span className="text-emerald-500">{counts.done ?? 0} done</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => clearQueue("completed")}
            disabled={!counts.done}
            className="text-xs px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Delete only the rows marked Done"
          >
            Archive done
            {counts.done ? ` (${counts.done})` : ""}
          </button>
          <button
            onClick={() => clearQueue("all")}
            disabled={singers.length === 0}
            className="text-xs px-2.5 py-1.5 rounded bg-rose-900 hover:bg-rose-800 disabled:opacity-40 disabled:cursor-not-allowed text-rose-100"
            title="Wipe the entire queue — end of night"
          >
            Clear all
          </button>
          <form action="/api/host/logout" method="post">
            <button className="text-xs text-zinc-400 hover:text-zinc-200" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="p-4 md:p-6 space-y-3 max-w-3xl mx-auto">
        <ManualAdd onAdd={manualAdd} />

        {singers.length === 0 && (
          <p className="text-zinc-500 text-center py-12">
            Queue is empty. Send singers to the URL on the QR sign.
          </p>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {singers.map((singer) => (
              <SortableRow
                key={singer.id}
                singer={singer}
                onStatus={(s) => setStatus(singer.id, s)}
                onExpress={() => express(singer.id)}
                onRemove={() => remove(singer.id)}
                onNotes={(n) => saveNotes(singer.id, n)}
                onTip={(amt) => addTip(singer.id, amt)}
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
  onStatus,
  onExpress,
  onRemove,
  onNotes,
  onTip,
}: {
  singer: Singer;
  onStatus: (s: SingerStatus) => void;
  onExpress: () => void;
  onRemove: () => void;
  onNotes: (n: string) => void;
  onTip: (amt: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: singer.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [notesOpen, setNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState(singer.notes ?? "");
  // Reset draft when the upstream note changes (e.g. another host edited it).
  // Derive-during-render avoids React 19's set-state-in-effect warning.
  const [lastSyncedNotes, setLastSyncedNotes] = useState(singer.notes);
  if (singer.notes !== lastSyncedNotes) {
    setLastSyncedNotes(singer.notes);
    setNotesDraft(singer.notes ?? "");
  }

  const isDone = singer.status === "done";
  const isHold = singer.status === "hold";

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
          aria-label="Drag to reorder"
          className="px-3 cursor-grab text-zinc-500 hover:text-zinc-300 touch-none"
        >
          ⋮⋮
        </button>

        <div className="flex-1 py-3 pr-3">
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className={`font-semibold truncate ${isDone ? "line-through text-zinc-500" : ""}`}>
                {singer.stage_name}
              </p>
              <p className="text-sm text-zinc-400 truncate italic">{singer.song}</p>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[singer.status]}`}
            >
              {STATUS_LABEL[singer.status]}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              onClick={onExpress}
              className="text-xs px-2.5 py-1 rounded bg-fuchsia-600 hover:bg-fuchsia-500 font-medium"
              title="Bump to the front of the queue (after current singer)"
            >
              Express Lane
            </button>
            <button
              onClick={() => onStatus("singing")}
              className="text-xs px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500"
            >
              Now singing
            </button>
            <button
              onClick={() => onStatus("done")}
              className="text-xs px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-600"
            >
              Done
            </button>
            <button
              onClick={() => onStatus(singer.status === "hold" ? "queued" : "hold")}
              className="text-xs px-2.5 py-1 rounded bg-amber-700 hover:bg-amber-600"
            >
              {singer.status === "hold" ? "Resume" : "Hold"}
            </button>
            <button
              onClick={() => setNotesOpen((o) => !o)}
              className="text-xs px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
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
              className="text-xs px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
              title={`Tip total: $${singer.tip_total}`}
            >
              Tip {singer.tip_total > 0 ? `$${singer.tip_total}` : ""}
            </button>
            <button
              onClick={onRemove}
              className="text-xs px-2.5 py-1 rounded bg-zinc-800 hover:bg-rose-900 text-zinc-400 hover:text-rose-200 ml-auto"
            >
              Remove
            </button>
          </div>

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
