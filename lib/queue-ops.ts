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

// All queue-mutating ops scope to the active session — rows not yet assigned
// to a closed night and not soft-archived. Closed-night rows are read-only
// stats; archived-but-not-yet-closed rows hide from the dashboard but stay
// in their existing positions.
function selectActiveSession() {
  return db
    .from("singers")
    .select("*")
    .is("night_id", null)
    .is("archived_at", null);
}

// Atomic queue renumber. Wraps the set_queue_order Postgres function, which
// takes an advisory lock and renumbers via a two-pass write inside a single
// transaction. Callers should pass every singer id; rows omitted from the
// array keep their current position and can collide with the unique constraint.
export async function setQueueOrder(orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return;
  const { error } = await db.rpc("set_queue_order", { ordered_ids: orderedIds });
  if (error) throw error;
}

// Re-fetch the queue, recompute statuses, and persist any changes.
// Call this after any operation that mutates queue_position or status.
export async function reconcileStatuses(): Promise<void> {
  const { data, error } = await selectActiveSession().returns<Singer[]>();
  if (error) throw error;
  if (!data) return;

  const updates = recomputeStatuses(data);
  if (updates.length === 0) return;

  // Status updates don't touch queue_position, so the unique constraint and
  // advisory lock aren't relevant here — parallel writes are safe.
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
  const { data, error } = await selectActiveSession()
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

  // Boundary smoothing: when rotation[i]'s last singer == rotation[i+1]'s
  // first singer, they'd play back-to-back at the rotation boundary. Try to
  // resolve by swapping within next rotation first (cheaper, preserves the
  // current rotation's order); if next has only one row or all same-singer,
  // fall back to swapping within current rotation. Preserves the
  // one-per-rotation invariant either way.
  for (let i = 0; i < rotations.length - 1; i++) {
    const rot = rotations[i];
    const next = rotations[i + 1];
    if (rot.length === 0 || next.length === 0) continue;
    const tailKey = singerKey(rot[rot.length - 1]);
    if (singerKey(next[0]) !== tailKey) continue;

    // Try next: swap next[0] with a later different-singer row in next.
    if (next.length >= 2) {
      const swapIdx = next.findIndex((r, j) => j > 0 && singerKey(r) !== tailKey);
      if (swapIdx > 0) {
        [next[0], next[swapIdx]] = [next[swapIdx], next[0]];
        continue;
      }
    }

    // Fallback: swap rot's tail with the latest different-singer row in rot.
    // Walking backward so we move the tail as little as possible.
    if (rot.length >= 2) {
      for (let k = rot.length - 2; k >= 0; k--) {
        if (singerKey(rot[k]) !== tailKey) {
          [rot[k], rot[rot.length - 1]] = [rot[rot.length - 1], rot[k]];
          break;
        }
      }
    }
  }

  // Final queue order: whoever is currently singing → rotations 1..N flattened
  // → hold (skipped singers, will rejoin) → done (history).
  const newOrder = [...singing, ...rotations.flat(), ...hold, ...done];
  await setQueueOrder(newOrder.map((s) => s.id));
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
  const { data, error } = await selectActiveSession()
    .order("queue_position", { ascending: true })
    .returns<Singer[]>();
  if (error) throw error;
  if (!data || data.length === 0) return;

  const sorted = [...data].sort((a, b) => {
    const diff = bucketOf(a) - bucketOf(b);
    if (diff !== 0) return diff;
    return a.queue_position - b.queue_position;
  });

  await setQueueOrder(sorted.map((s) => s.id));
}
