import { db, type Singer } from "./supabase";
import { recomputeStatuses } from "./tiers";

const ROTATION_STATUSES = ["queued", "getting_closer", "on_deck"] as const;
type RotationStatus = (typeof ROTATION_STATUSES)[number];
function isRotation(s: Singer): s is Singer & { status: RotationStatus } {
  return (ROTATION_STATUSES as readonly string[]).includes(s.status);
}

function singerKey(s: Singer): string {
  return s.singer_token ?? `name:${s.stage_name.toLowerCase()}`;
}

// Re-fetch the queue, recompute statuses, and persist any changes.
// Call this after any operation that mutates queue_position or status.
export async function reconcileStatuses(): Promise<void> {
  const { data, error } = await db
    .from("singers")
    .select("*")
    .returns<Singer[]>();
  if (error) throw error;
  if (!data) return;

  const updates = recomputeStatuses(data);
  if (updates.length === 0) return;

  // Issue individual updates in parallel. The set is small (≤ rotation size).
  await Promise.all(
    updates.map((u) =>
      db.from("singers").update({ status: u.status }).eq("id", u.id),
    ),
  );
}

// Rotation-based fairness: every singer gets at most one song per rotation.
// Walk the queue in arrival order; drop each row into the earliest rotation
// that doesn't already contain that singer. A new singer joins the current
// rotation; a singer's nth song lands in rotation n.
//
// Sticky states (singing / hold / done) are not touched; we renumber the
// rotation slots around them.
export async function fairInterleave(): Promise<void> {
  const { data, error } = await db
    .from("singers")
    .select("*")
    .order("submitted_at", { ascending: true })
    .returns<Singer[]>();
  if (error || !data) return;
  if (data.length === 0) return;

  const singing = data.filter((s) => s.status === "singing");
  const rotationRows = data.filter(isRotation);
  const hold = data.filter((s) => s.status === "hold");
  const done = data.filter((s) => s.status === "done");

  const rotations: Singer[][] = [];
  for (const row of rotationRows) {
    const key = singerKey(row);
    let placed = false;
    for (const rot of rotations) {
      if (!rot.some((r) => singerKey(r) === key)) {
        rot.push(row);
        placed = true;
        break;
      }
    }
    if (!placed) rotations.push([row]);
  }

  // Final queue order: whoever is currently singing → rotations 1..N flattened
  // → hold (skipped singers, will rejoin) → done (history).
  const newOrder = [...singing, ...rotations.flat(), ...hold, ...done];

  const writes = newOrder
    .map((s, idx) => ({ id: s.id, position: idx + 1, old: s.queue_position }))
    .filter((w) => w.position !== w.old);

  await Promise.all(
    writes.map((w) =>
      db.from("singers").update({ queue_position: w.position }).eq("id", w.id),
    ),
  );
}

// Bucket order in the queue:
//   0. singing  (currently performing — top)
//   1. rotation (queued / getting_closer / on_deck — active queue)
//   2. hold     (skipped for now, will rejoin)
//   3. done     (history)
function bucketOf(s: Singer): number {
  if (s.status === "singing") return 0;
  if (s.status === "hold") return 2;
  if (s.status === "done") return 3;
  return 1;
}

// Renumber queue_position 1..N with bucket ordering enforced. Within each
// bucket, the existing order (by current queue_position) is preserved so
// host drag-reorders inside the active rotation aren't disturbed.
export async function compactPositions(): Promise<void> {
  const { data, error } = await db
    .from("singers")
    .select("*")
    .order("queue_position", { ascending: true })
    .returns<Singer[]>();
  if (error) throw error;
  if (!data) return;

  const sorted = [...data].sort((a, b) => {
    const diff = bucketOf(a) - bucketOf(b);
    if (diff !== 0) return diff;
    return a.queue_position - b.queue_position;
  });

  const writes = sorted
    .map((s, idx) => ({ id: s.id, position: idx + 1, old: s.queue_position }))
    .filter((w) => w.position !== w.old);

  await Promise.all(
    writes.map((w) =>
      db.from("singers").update({ queue_position: w.position }).eq("id", w.id),
    ),
  );
}
