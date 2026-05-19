/*
 * Queue simulation. Runs against your real Supabase project — it WILL clear
 * the singers table. Don't run during a live night.
 *
 *   bun run test:queue
 */
import { db, type Singer } from "@/lib/supabase";
import { fairInterleave } from "@/lib/queue-ops";
import { reconcileStatuses } from "@/lib/queue-ops";

type Scenario = {
  title: string;
  steps: Array<{ name: string; song: string; token?: string }>;
};

const SCENARIOS: Scenario[] = [
  {
    title: "Three different singers, one song each",
    steps: [
      { name: "Alice", song: "Wonderwall", token: "t-alice" },
      { name: "Bob", song: "Mr. Brightside", token: "t-bob" },
      { name: "Carol", song: "Africa", token: "t-carol" },
    ],
  },
  {
    title: "Bob submits three in a row, nobody else in line",
    steps: [
      { name: "Bob", song: "song A", token: "t-bob" },
      { name: "Bob", song: "song B", token: "t-bob" },
      { name: "Bob", song: "song C", token: "t-bob" },
    ],
  },
  {
    title: "Bob, Bob, Alice — Bob's second should slot AFTER Alice",
    steps: [
      { name: "Bob", song: "song A", token: "t-bob" },
      { name: "Bob", song: "song B", token: "t-bob" },
      { name: "Alice", song: "song C", token: "t-alice" },
    ],
  },
  {
    title: "Heavy Bob: A B B B Carol B Alice — interleave under pressure",
    steps: [
      { name: "Alice", song: "1", token: "t-alice" },
      { name: "Bob", song: "2", token: "t-bob" },
      { name: "Bob", song: "3", token: "t-bob" },
      { name: "Bob", song: "4", token: "t-bob" },
      { name: "Carol", song: "5", token: "t-carol" },
      { name: "Bob", song: "6", token: "t-bob" },
      { name: "Alice", song: "7", token: "t-alice" },
    ],
  },
  {
    title: "Walk-up adds by host (no token) — should still interleave by name",
    steps: [
      { name: "Dan", song: "1" },
      { name: "Dan", song: "2" },
      { name: "Eve", song: "3" },
      { name: "Dan", song: "4" },
    ],
  },
  {
    title: "Realistic 25-song night: 10 singers, mixed frequencies",
    // Frequencies: Eve=5 (power), Bob=4, Alice=3, Hank=3,
    //              Carol=2, Frank=2, Ivy=2, Jack=2, Dan=1, Grace=1
    steps: [
      { name: "Alice", song: "a1", token: "t-alice" },
      { name: "Bob", song: "b1", token: "t-bob" },
      { name: "Carol", song: "c1", token: "t-carol" },
      { name: "Dan", song: "d1", token: "t-dan" },
      { name: "Eve", song: "e1", token: "t-eve" },
      { name: "Frank", song: "f1", token: "t-frank" },
      { name: "Bob", song: "b2", token: "t-bob" },
      { name: "Grace", song: "g1", token: "t-grace" },
      { name: "Eve", song: "e2", token: "t-eve" },
      { name: "Alice", song: "a2", token: "t-alice" },
      { name: "Hank", song: "h1", token: "t-hank" },
      { name: "Bob", song: "b3", token: "t-bob" },
      { name: "Eve", song: "e3", token: "t-eve" },
      { name: "Ivy", song: "i1", token: "t-ivy" },
      { name: "Jack", song: "j1", token: "t-jack" },
      { name: "Eve", song: "e4", token: "t-eve" },
      { name: "Hank", song: "h2", token: "t-hank" },
      { name: "Bob", song: "b4", token: "t-bob" },
      { name: "Carol", song: "c2", token: "t-carol" },
      { name: "Eve", song: "e5", token: "t-eve" },
      { name: "Frank", song: "f2", token: "t-frank" },
      { name: "Hank", song: "h3", token: "t-hank" },
      { name: "Ivy", song: "i2", token: "t-ivy" },
      { name: "Jack", song: "j2", token: "t-jack" },
      { name: "Alice", song: "a3", token: "t-alice" },
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
    const adjacent = prev && prev.stage_name === r.stage_name;
    const flag = adjacent ? "  ⚠ adjacent" : "";
    console.log(
      `  ${String(r.queue_position).padStart(2)}. ${r.stage_name.padEnd(7)} "${r.song}"${flag}`,
    );
  });
}

async function runScenario(scenario: Scenario, idx: number) {
  console.log(`\n=== Scenario ${idx + 1}: ${scenario.title} ===`);
  await clearTable();
  for (const step of scenario.steps) {
    await add(step.name, step.song, step.token);
  }
  const rows = await snapshot();
  printQueue(rows);

  const adjacent = rows.filter(
    (r, i) => i > 0 && rows[i - 1].stage_name === r.stage_name,
  );
  if (adjacent.length === 0) {
    console.log("  ✅ no same-singer adjacencies");
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
