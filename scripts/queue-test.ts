/*
 * Queue rotation tests — IN-MEMORY ONLY. This script does NOT touch
 * the database. Safe to run any time, including the middle of a bar night.
 *
 *   bun run test:queue
 *
 * It exercises the same `computeFairOrder` function the production
 * /api/host/fairInterleave path uses, against synthetic singer arrays.
 * Any change to the rotation logic should be verified here before deploy.
 */

import { computeFairOrder } from "@/lib/queue-ops";
import type { Singer, SingerStatus } from "@/lib/supabase";

type Step =
  | { type: "add"; name: string; token?: string }
  | { type: "done"; name: string };

type Scenario = { title: string; steps: Step[] };

const sub = (name: string, token?: string): Step => ({
  type: "add",
  name,
  token,
});
const done = (name: string): Step => ({ type: "done", name });

const SCENARIOS: Scenario[] = [
  {
    title: "Three different singers, one song each",
    steps: [sub("Alice", "t-alice"), sub("Bob", "t-bob"), sub("Carol", "t-carol")],
  },
  {
    title: "Bob submits three in a row, nobody else in line",
    steps: [sub("Bob", "t-bob"), sub("Bob", "t-bob"), sub("Bob", "t-bob")],
  },
  {
    title: "Bob, Bob, Alice — Bob's second should slot AFTER Alice",
    steps: [sub("Bob", "t-bob"), sub("Bob", "t-bob"), sub("Alice", "t-alice")],
  },
  {
    title: "Heavy Bob: A B B B C B A — interleave under pressure",
    steps: [
      sub("Alice", "t-alice"),
      sub("Bob", "t-bob"),
      sub("Bob", "t-bob"),
      sub("Bob", "t-bob"),
      sub("Carol", "t-carol"),
      sub("Bob", "t-bob"),
      sub("Alice", "t-alice"),
    ],
  },
  {
    title: "Walk-up adds by host (no token) — interleave by name",
    steps: [sub("Dan"), sub("Dan"), sub("Eve"), sub("Dan")],
  },
  {
    title: "Realistic 25-song night, 10 singers",
    steps: [
      sub("Alice", "t-alice"),
      sub("Bob", "t-bob"),
      sub("Carol", "t-carol"),
      sub("Dan", "t-dan"),
      sub("Eve", "t-eve"),
      sub("Frank", "t-frank"),
      sub("Bob", "t-bob"),
      sub("Grace", "t-grace"),
      sub("Eve", "t-eve"),
      sub("Alice", "t-alice"),
      sub("Hank", "t-hank"),
      sub("Bob", "t-bob"),
      sub("Eve", "t-eve"),
      sub("Ivy", "t-ivy"),
      sub("Jack", "t-jack"),
      sub("Eve", "t-eve"),
      sub("Hank", "t-hank"),
      sub("Bob", "t-bob"),
      sub("Carol", "t-carol"),
      sub("Eve", "t-eve"),
      sub("Frank", "t-frank"),
      sub("Hank", "t-hank"),
      sub("Ivy", "t-ivy"),
      sub("Jack", "t-jack"),
      sub("Alice", "t-alice"),
    ],
  },
  {
    title:
      "Joey Bonez case: Bob sang earlier, then queues 2 more while Carol is in line",
    steps: [
      sub("Bob", "t-bob"),
      sub("Carol", "t-carol"),
      done("Bob"),
      sub("Bob", "t-bob"),
      sub("Bob", "t-bob"),
    ],
  },
  {
    title: "Mid-night: 5 singers, 3 done, top singer subs 2 more",
    steps: [
      sub("Alice", "t-alice"),
      sub("Bob", "t-bob"),
      sub("Carol", "t-carol"),
      sub("Dan", "t-dan"),
      sub("Eve", "t-eve"),
      done("Alice"),
      done("Bob"),
      done("Carol"),
      sub("Alice", "t-alice"),
      sub("Alice", "t-alice"),
    ],
  },
  {
    title: "Boundary stress: [X X Y] should reorder to [X Y X]",
    steps: [sub("X", "t-x"), sub("X", "t-x"), sub("Y", "t-y")],
  },
  {
    title:
      "First-timer priority: Bob sang, then Bob + newcomer Carol each queue one — Carol first",
    steps: [
      sub("Bob", "t-bob"),
      done("Bob"),
      sub("Bob", "t-bob"),
      sub("Carol", "t-carol"),
    ],
  },
  {
    title: "Half the room done, returning singer drops 3 — weave with the rest",
    steps: [
      sub("Mike", "t-mike"),
      sub("Nat", "t-nat"),
      sub("Ollie", "t-ollie"),
      sub("Pat", "t-pat"),
      done("Mike"),
      done("Nat"),
      sub("Quinn", "t-quinn"),
      sub("Rae", "t-rae"),
      sub("Mike", "t-mike"),
      sub("Mike", "t-mike"),
      sub("Mike", "t-mike"),
    ],
  },
];

// -----------------------------------------------------------------------------
// In-memory simulation. State is just an ordered array of Singer-shaped objs.
// Each `add` appends a new singer and runs computeFairOrder. Each `done` marks
// the oldest non-done row with that name as done, then re-runs computeFairOrder.
// -----------------------------------------------------------------------------

function makeSinger(name: string, token: string | undefined, idx: number): Singer {
  // Synthetic but well-formed Singer record. submitted_at is set in arrival
  // order so the algorithm processes rows in the same order they were added.
  return {
    id: `id-${idx}`,
    stage_name: name,
    song: `song-${idx}`,
    submitted_at: new Date(2026, 0, 1, 0, 0, idx).toISOString(),
    queue_position: idx + 1,
    status: "queued" as SingerStatus,
    notes: null,
    tip_total: 0,
    singer_token: token ?? null,
    started_singing_at: null,
    finished_singing_at: null,
    archived_at: null,
    night_id: null,
  };
}

function simulate(scenario: Scenario): Singer[] {
  let rows: Singer[] = [];
  let idx = 0;
  for (const step of scenario.steps) {
    if (step.type === "add") {
      rows.push(makeSinger(step.name, step.token, idx++));
    } else {
      // Oldest non-done row matching the name (case-insensitive).
      const target = rows.find(
        (r) =>
          r.stage_name.toLowerCase() === step.name.toLowerCase() &&
          r.status !== "done",
      );
      if (!target) throw new Error(`No active row for "${step.name}" to mark done`);
      target.status = "done";
    }
    rows = computeFairOrder(rows);
  }
  return rows;
}

function printQueue(rows: Singer[]) {
  if (rows.length === 0) {
    console.log("  (empty)");
    return;
  }
  const rotationOf = new Map<string, number>();
  let currentRotation = 1;
  let currentNames = new Set<string>();
  // Only the active session counts for rotation labeling. Done rows sit
  // outside rotations (they're history).
  const active = rows.filter((r) => r.status !== "done");
  for (const r of active) {
    const key = r.stage_name.toLowerCase();
    if (currentNames.has(key)) {
      currentRotation++;
      currentNames = new Set();
    }
    currentNames.add(key);
    rotationOf.set(r.id, currentRotation);
  }

  let lastRot = 0;
  rows.forEach((r, i) => {
    const isDone = r.status === "done";
    const rot = rotationOf.get(r.id);
    if (!isDone && rot !== undefined && rot !== lastRot) {
      console.log(`  --- Rotation ${rot} ---`);
      lastRot = rot;
    }
    if (isDone && lastRot !== -1) {
      console.log(`  --- Done ---`);
      lastRot = -1;
    }
    const prev = rows[i - 1];
    const adjacent =
      prev &&
      prev.status !== "done" &&
      r.status !== "done" &&
      prev.stage_name.toLowerCase() === r.stage_name.toLowerCase();
    const flag = adjacent ? "  ⚠ adjacent" : "";
    console.log(
      `  ${String(i + 1).padStart(2)}. ${r.stage_name.padEnd(7)} "${r.song}"${flag}`,
    );
  });
}

function checkAdjacencies(rows: Singer[]): { count: number; cases: string[] } {
  const active = rows.filter((r) => r.status !== "done");
  const cases: string[] = [];
  for (let i = 1; i < active.length; i++) {
    if (
      active[i - 1].stage_name.toLowerCase() ===
      active[i].stage_name.toLowerCase()
    ) {
      cases.push(`${active[i - 1].stage_name} x2 at positions ${i}+${i + 1}`);
    }
  }
  return { count: cases.length, cases };
}

let totalScenarios = 0;
let totalAdjacencies = 0;

for (let i = 0; i < SCENARIOS.length; i++) {
  const scenario = SCENARIOS[i];
  console.log(`\n=== Scenario ${i + 1}: ${scenario.title} ===`);
  const result = simulate(scenario);
  printQueue(result);
  const { count, cases } = checkAdjacencies(result);
  if (count === 0) {
    console.log("  ✅ no same-singer adjacencies in active queue");
  } else {
    console.log(
      `  ⚠ ${count} adjacency/ies (may be unavoidable if one singer dominates):`,
    );
    for (const c of cases) console.log(`     ${c}`);
  }
  totalScenarios++;
  totalAdjacencies += count;
}

console.log(
  `\n${totalScenarios} scenarios run · ${totalAdjacencies} total adjacencies (most should be unavoidable single-singer-dominance cases)`,
);
console.log("Zero rows touched in the database. ✓");
