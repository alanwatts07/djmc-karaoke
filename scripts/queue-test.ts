/*
 * Queue simulation. ⚠️ DESTRUCTIVE — wipes the singers table. Closed nights
 * survive via the `nights` table (aggregate stats), but the per-singer rows
 * for those nights are deleted. Requires --confirm-wipe to actually run.
 *
 *   bun run test:queue --confirm-wipe
 */
if (!process.argv.includes("--confirm-wipe")) {
  console.error(
    "Refusing to run — this script DELETES every row in the singers table.",
  );
  console.error(
    "Past nights' aggregate stats survive (they're on the nights table),",
  );
  console.error("but per-singer rows are gone forever.");
  console.error("");
  console.error("If you really want to do this, re-run with --confirm-wipe.");
  process.exit(1);
}

import { db, type Singer } from "@/lib/supabase";
import { fairInterleave } from "@/lib/queue-ops";
import { reconcileStatuses, compactPositions } from "@/lib/queue-ops";

type Step =
  | { type: "add"; name: string; song: string; token?: string }
  | { type: "done"; name: string };

type Scenario = {
  title: string;
  // Mix of submissions and "mark this singer's oldest non-done row as done".
  // Steps run in order so you can simulate mid-night state changes.
  steps: Step[];
};

// Tiny DSL shortcut so the existing fresh-only scenarios stay readable.
const sub = (name: string, song: string, token?: string): Step => ({
  type: "add",
  name,
  song,
  token,
});
const done = (name: string): Step => ({ type: "done", name });

const SCENARIOS: Scenario[] = [
  {
    title: "Three different singers, one song each",
    steps: [
      sub("Alice", "Wonderwall", "t-alice"),
      sub("Bob", "Mr. Brightside", "t-bob"),
      sub("Carol", "Africa", "t-carol"),
    ],
  },
  {
    title: "Bob submits three in a row, nobody else in line",
    steps: [
      sub("Bob", "song A", "t-bob"),
      sub("Bob", "song B", "t-bob"),
      sub("Bob", "song C", "t-bob"),
    ],
  },
  {
    title: "Bob, Bob, Alice — Bob's second should slot AFTER Alice",
    steps: [
      sub("Bob", "song A", "t-bob"),
      sub("Bob", "song B", "t-bob"),
      sub("Alice", "song C", "t-alice"),
    ],
  },
  {
    title: "Heavy Bob: A B B B Carol B Alice — interleave under pressure",
    steps: [
      sub("Alice", "1", "t-alice"),
      sub("Bob", "2", "t-bob"),
      sub("Bob", "3", "t-bob"),
      sub("Bob", "4", "t-bob"),
      sub("Carol", "5", "t-carol"),
      sub("Bob", "6", "t-bob"),
      sub("Alice", "7", "t-alice"),
    ],
  },
  {
    title: "Walk-up adds by host (no token) — should still interleave by name",
    steps: [
      sub("Dan", "1"),
      sub("Dan", "2"),
      sub("Eve", "3"),
      sub("Dan", "4"),
    ],
  },
  {
    title: "Realistic 25-song night: 10 singers, mixed frequencies",
    steps: [
      sub("Alice", "a1", "t-alice"),
      sub("Bob", "b1", "t-bob"),
      sub("Carol", "c1", "t-carol"),
      sub("Dan", "d1", "t-dan"),
      sub("Eve", "e1", "t-eve"),
      sub("Frank", "f1", "t-frank"),
      sub("Bob", "b2", "t-bob"),
      sub("Grace", "g1", "t-grace"),
      sub("Eve", "e2", "t-eve"),
      sub("Alice", "a2", "t-alice"),
      sub("Hank", "h1", "t-hank"),
      sub("Bob", "b3", "t-bob"),
      sub("Eve", "e3", "t-eve"),
      sub("Ivy", "i1", "t-ivy"),
      sub("Jack", "j1", "t-jack"),
      sub("Eve", "e4", "t-eve"),
      sub("Hank", "h2", "t-hank"),
      sub("Bob", "b4", "t-bob"),
      sub("Carol", "c2", "t-carol"),
      sub("Eve", "e5", "t-eve"),
      sub("Frank", "f2", "t-frank"),
      sub("Hank", "h3", "t-hank"),
      sub("Ivy", "i2", "t-ivy"),
      sub("Jack", "j2", "t-jack"),
      sub("Alice", "a3", "t-alice"),
    ],
  },

  // -------------------------------------------------------------------------
  // Mid-night scenarios — these caused issues in real bar nights.
  // -------------------------------------------------------------------------
  {
    title:
      "Joey Bonez case: Bob sang earlier, then queues 2 more while Carol is in line",
    // Real-world: a singer who already has a 'done' row submits more songs.
    // Bob's first song was sung. The rotation builder shouldn't see Bob's done
    // row as occupying a rotation slot, but his TWO new songs must not end up
    // back-to-back if Carol is still waiting.
    steps: [
      sub("Bob", "b1", "t-bob"),
      sub("Carol", "c1", "t-carol"),
      done("Bob"),
      sub("Bob", "b2", "t-bob"),
      sub("Bob", "b3", "t-bob"),
    ],
  },
  {
    title: "Trio mid-night: 5 singers, 3 done, then top singer subs 2 more",
    steps: [
      sub("Alice", "a1", "t-alice"),
      sub("Bob", "b1", "t-bob"),
      sub("Carol", "c1", "t-carol"),
      sub("Dan", "d1", "t-dan"),
      sub("Eve", "e1", "t-eve"),
      done("Alice"),
      done("Bob"),
      done("Carol"),
      sub("Alice", "a2", "t-alice"),
      sub("Alice", "a3", "t-alice"),
    ],
  },
  {
    title:
      "Boundary stress: rotation 1 ends with X and rotation 2 starts with X",
    // X has 2 songs queued, Y has 1, no others. Naive: [Y, X, X] adjacent.
    // Smoothing should swap to [X, Y, X].
    steps: [
      sub("X", "x1", "t-x"),
      sub("X", "x2", "t-x"),
      sub("Y", "y1", "t-y"),
    ],
  },
  {
    title:
      "Half the room done, returning singer drops 3 — should weave with the rest",
    steps: [
      sub("Mike", "m1", "t-mike"),
      sub("Nat", "n1", "t-nat"),
      sub("Ollie", "o1", "t-ollie"),
      sub("Pat", "p1", "t-pat"),
      done("Mike"),
      done("Nat"),
      sub("Quinn", "q1", "t-quinn"),
      sub("Rae", "r1", "t-rae"),
      sub("Mike", "m2", "t-mike"),
      sub("Mike", "m3", "t-mike"),
      sub("Mike", "m4", "t-mike"),
    ],
  },
];

async function clearTable() {
  // delete EVERYTHING. The .neq trick is needed because supabase-js requires
  // a filter on delete().
  const { error } = await db
    .from("singers")
    .delete()
    .gte("submitted_at", "1970-01-01");
  if (error) throw error;
}

async function add(name: string, song: string, token?: string) {
  const { error } = await db
    .from("singers")
    .insert({ stage_name: name, song, singer_token: token ?? null });
  if (error) throw error;
  await fairInterleave();
  await reconcileStatuses();
}

// Mark the oldest non-done row with this stage_name as done. Mirrors what
// /api/host/status does for a "Done" click (without the timestamp tracking,
// which doesn't matter for rotation testing).
async function markDone(name: string) {
  const { data } = await db
    .from("singers")
    .select("id")
    .ilike("stage_name", name)
    .neq("status", "done")
    .order("submitted_at", { ascending: true })
    .limit(1)
    .maybeSingle<Pick<Singer, "id">>();
  if (!data) throw new Error(`No active row for "${name}" to mark done`);
  await db.from("singers").update({ status: "done" }).eq("id", data.id);
  await compactPositions();
  await reconcileStatuses();
}

async function snapshot(): Promise<Singer[]> {
  const { data, error } = await db
    .from("singers")
    .select("*")
    .order("queue_position", { ascending: true })
    .returns<Singer[]>();
  if (error) throw error;
  return data ?? [];
}

function printQueue(rows: Singer[]) {
  if (rows.length === 0) {
    console.log("  (empty)");
    return;
  }
  // Compute rotation index for each row: a new rotation starts when a name
  // we've already seen in the current rotation appears again.
  const rotationOf = new Map<string, number>();
  let currentRotation = 1;
  let currentRotationNames = new Set<string>();
  for (const r of rows) {
    const key = r.stage_name.toLowerCase();
    if (currentRotationNames.has(key)) {
      currentRotation++;
      currentRotationNames = new Set();
    }
    currentRotationNames.add(key);
    rotationOf.set(r.id, currentRotation);
  }

  let lastRot = 0;
  rows.forEach((r, i) => {
    const rot = rotationOf.get(r.id) ?? 0;
    if (rot !== lastRot) {
      console.log(`  --- Rotation ${rot} ---`);
      lastRot = rot;
    }
    const prev = rows[i - 1];
    // Only flag if both rows are still active — done-vs-active boundaries are
    // not real adjacencies for the singer (the done row is in the past band).
    const isActiveBoundary =
      prev &&
      prev.status !== "done" &&
      r.status !== "done" &&
      prev.stage_name === r.stage_name;
    const flag = isActiveBoundary ? "  ⚠ adjacent" : "";
    console.log(
      `  ${String(r.queue_position).padStart(2)}. ${r.stage_name.padEnd(7)} "${r.song}"${flag}`,
    );
  });
}

async function runScenario(scenario: Scenario, idx: number) {
  console.log(`\n=== Scenario ${idx + 1}: ${scenario.title} ===`);
  await clearTable();
  for (const step of scenario.steps) {
    if (step.type === "add") {
      await add(step.name, step.song, step.token);
    } else {
      await markDone(step.name);
    }
  }
  const rows = await snapshot();
  printQueue(rows);

  // Adjacency check ONLY considers active rows — done rows at the back of the
  // queue don't count as "adjacent to" each other from the singer's POV.
  const active = rows.filter((r) => r.status !== "done");
  const adjacent = active.filter(
    (r, i) =>
      i > 0 &&
      active[i - 1].stage_name.toLowerCase() === r.stage_name.toLowerCase(),
  );
  if (adjacent.length === 0) {
    console.log("  ✅ no same-singer adjacencies in active queue");
  } else {
    console.log(
      `  ⚠ ${adjacent.length} same-singer adjacency/ies (may be unavoidable if one singer dominates)`,
    );
  }
}

async function main() {
  for (let i = 0; i < SCENARIOS.length; i++) {
    await runScenario(SCENARIOS[i], i);
  }
  console.log("\nDone. Run `bun run test:queue:reset` if you want to clear the table.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
