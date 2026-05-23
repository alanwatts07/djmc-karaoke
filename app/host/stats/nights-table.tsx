"use client";

import { useState } from "react";
import type { Night } from "@/lib/supabase";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeRange(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  return `${fmt(start)} → ${fmt(end)}`;
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

// datetime-local needs YYYY-MM-DDTHH:MM in local time (no Z suffix).
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

function localInputToIso(local: string): string | null {
  if (!local) return null;
  const ms = new Date(local).getTime();
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export default function NightsTable({ initial }: { initial: Night[] }) {
  const [nights, setNights] = useState<Night[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Records — only meaningful with multiple nights.
  const recordBiggest = nights.reduce<Night | null>(
    (best, n) =>
      best === null || n.total_signups > best.total_signups ? n : best,
    null,
  );
  const sungOnly = nights.filter(
    (n) => n.total_sung > 0 && n.mins_per_singer !== null,
  );
  const recordFastest = sungOnly.reduce<Night | null>(
    (best, n) =>
      best === null ||
      (n.mins_per_singer ?? Infinity) < (best.mins_per_singer ?? Infinity)
        ? n
        : best,
    null,
  );

  async function refetch() {
    const res = await fetch("/api/host/nights", { cache: "no-store" });
    if (!res.ok) return;
    const { nights: next } = (await res.json()) as { nights: Night[] };
    setNights(next);
  }

  async function saveEdit(
    id: string,
    fields: {
      name: string | null;
      started_at: string | null;
      ended_at: string | null;
      total_signups: number;
      total_sung: number;
    },
  ) {
    const res = await fetch("/api/host/edit-night", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...fields }),
    });
    if (!res.ok) {
      alert("Couldn't save changes.");
      return;
    }
    await refetch();
    setEditingId(null);
  }

  return (
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
                {recordBiggest.name ?? formatDate(recordBiggest.ended_at)}
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
                per singer ·{" "}
                {recordFastest.name ?? formatDate(recordFastest.ended_at)}
              </p>
            </>
          ) : (
            <p className="text-zinc-500">—</p>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-800 mt-6">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-zinc-400">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Night</th>
              <th className="text-right px-3 py-2 font-medium">Signups</th>
              <th className="text-right px-3 py-2 font-medium">Sung</th>
              <th className="text-right px-3 py-2 font-medium">Duration</th>
              <th className="text-right px-3 py-2 font-medium">Min / singer</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {nights.map((n) => {
              const isEditing = editingId === n.id;
              const isBiggest = n.id === recordBiggest?.id;
              const isFastest = n.id === recordFastest?.id;
              const needsBackfill = !n.started_at || !n.ended_at;

              if (isEditing) {
                return (
                  <EditRow
                    key={n.id}
                    night={n}
                    onSave={(fields) => saveEdit(n.id, fields)}
                    onCancel={() => setEditingId(null)}
                  />
                );
              }

              return (
                <tr
                  key={n.id}
                  className="border-t border-zinc-800 hover:bg-zinc-900/50"
                >
                  <td className="px-3 py-2">
                    <div className="font-medium">
                      {n.name ?? formatDate(n.ended_at)}
                      {needsBackfill && (
                        <span className="ml-2 text-xs text-amber-400">
                          ⚠ missing times
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {formatTimeRange(n.started_at, n.ended_at)}
                    </div>
                  </td>
                  <td className="text-right px-3 py-2">
                    {n.total_signups}
                    {isBiggest && <span className="ml-1">⭐</span>}
                  </td>
                  <td className="text-right px-3 py-2 text-zinc-400">
                    {n.total_sung}
                  </td>
                  <td className="text-right px-3 py-2 text-zinc-400">
                    {formatDuration(n.duration_seconds)}
                  </td>
                  <td className="text-right px-3 py-2">
                    {formatMins(n.mins_per_singer)}
                    {isFastest && <span className="ml-1">⚡</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => setEditingId(n.id)}
                      className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                    >
                      ✏️
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function EditRow({
  night,
  onSave,
  onCancel,
}: {
  night: Night;
  onSave: (fields: {
    name: string | null;
    started_at: string | null;
    ended_at: string | null;
    total_signups: number;
    total_sung: number;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(night.name ?? "");
  const [startLocal, setStartLocal] = useState(isoToLocalInput(night.started_at));
  const [endLocal, setEndLocal] = useState(isoToLocalInput(night.ended_at));
  const [signups, setSignups] = useState(String(night.total_signups));
  const [sung, setSung] = useState(String(night.total_sung));
  const [busy, setBusy] = useState(false);

  async function submit() {
    const signupsN = Number(signups);
    const sungN = Number(sung);
    if (!Number.isFinite(signupsN) || signupsN < 0) return;
    if (!Number.isFinite(sungN) || sungN < 0) return;
    setBusy(true);
    try {
      await onSave({
        name: name.trim() || null,
        started_at: localInputToIso(startLocal),
        ended_at: localInputToIso(endLocal),
        total_signups: Math.floor(signupsN),
        total_sung: Math.floor(sungN),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-t border-zinc-800 bg-zinc-900/70">
      <td colSpan={6} className="px-3 py-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
          <label className="text-xs text-zinc-400">
            Name (optional)
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={formatDate(night.ended_at)}
              disabled={busy}
              className="block w-full mt-1 rounded bg-zinc-950 border border-zinc-800 px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-zinc-400">
              Signups
              <input
                type="number"
                min="0"
                value={signups}
                onChange={(e) => setSignups(e.target.value)}
                disabled={busy}
                className="block w-full mt-1 rounded bg-zinc-950 border border-zinc-800 px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
              />
            </label>
            <label className="text-xs text-zinc-400">
              Sung
              <input
                type="number"
                min="0"
                value={sung}
                onChange={(e) => setSung(e.target.value)}
                disabled={busy}
                className="block w-full mt-1 rounded bg-zinc-950 border border-zinc-800 px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
              />
            </label>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
          <label className="text-xs text-zinc-400">
            First song started (local time)
            <input
              type="datetime-local"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
              disabled={busy}
              className="block w-full mt-1 rounded bg-zinc-950 border border-zinc-800 px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
            />
          </label>
          <label className="text-xs text-zinc-400">
            Last singer finished (local time)
            <input
              type="datetime-local"
              value={endLocal}
              onChange={(e) => setEndLocal(e.target.value)}
              disabled={busy}
              className="block w-full mt-1 rounded bg-zinc-950 border border-zinc-800 px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
            />
          </label>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={busy}
            className="text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="text-xs px-3 py-1.5 rounded bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 font-medium"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </td>
    </tr>
  );
}
