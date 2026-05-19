import type { Singer, SingerStatus } from "./supabase";

// Tier derivation. The host's drag-reorder rewrites queue_position; this
// function maps positions back to public-facing statuses. Statuses that the
// host has set explicitly (singing, done, hold) are left alone.
//
// Rules:
//   - position 1 → on_deck
//   - position 2 → on_deck   (two slots feels honest: "you or the next one")
//   - position 3..5 → getting_closer
//   - position 6+ → queued
//
// We operate on the rows that are *in the rotation* (status in queued,
// getting_closer, on_deck) and ignore the rest. The host-set states
// (singing, done, hold) are untouched.

const ROTATION: SingerStatus[] = ["queued", "getting_closer", "on_deck"];

export function deriveStatus(positionInRotation: number): SingerStatus {
  if (positionInRotation <= 2) return "on_deck";
  if (positionInRotation <= 5) return "getting_closer";
  return "queued";
}

export type StatusUpdate = { id: string; status: SingerStatus };

// Given the full singer list, compute the status each rotation singer should
// have. Returns only the rows whose status would change.
export function recomputeStatuses(singers: Singer[]): StatusUpdate[] {
  const rotation = singers
    .filter((s) => ROTATION.includes(s.status))
    .sort((a, b) => a.queue_position - b.queue_position);

  const updates: StatusUpdate[] = [];
  rotation.forEach((singer, idx) => {
    const desired = deriveStatus(idx + 1);
    if (singer.status !== desired) {
      updates.push({ id: singer.id, status: desired });
    }
  });
  return updates;
}

// Singers see only three states: "Coming Up" (anything pre-singing), "You're
// Up!" (currently singing), or "Thanks for Singing" (done). This is the
// blind queue from plan.md — no rotation hints, no position numbers, so the
// host can reorder freely without breaking promises.
export function publicTierLabel(status: SingerStatus): string {
  switch (status) {
    case "singing":
      return "You're Up!";
    case "done":
      return "Thanks for Singing";
    case "queued":
    case "getting_closer":
    case "on_deck":
    case "hold":
      return "Coming Up";
  }
}

export function publicTierSubtext(status: SingerStatus): string {
  switch (status) {
    case "singing":
      return "Get up there!";
    case "done":
      return "Hope you killed it. Submit again any time.";
    case "queued":
    case "getting_closer":
    case "on_deck":
    case "hold":
      return "You're locked into the rotation. Grab a drink and listen for your name.";
  }
}
