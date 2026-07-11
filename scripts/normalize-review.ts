// Post-night normalization loop.
//
//   bun run scripts/normalize-review.ts
//
// Lists every raw stage_name and song in the archive that is NOT yet in the
// hand-built maps in lib/stats/normalize.ts, with the context needed to map
// them (how many times, which device tokens, what else that person sang).
//
// Workflow after a new night: run this, paste the output to Claude, confirm the
// uncertain ones, and Claude appends the new mappings to lib/stats/normalize.ts.
// Read-only — never writes to the database.

import { db, type Singer } from "@/lib/supabase";
import { isMappedSinger, isMappedSong } from "@/lib/stats/normalize";

const { data } = await db
  .from("singers")
  .select("*")
  .not("night_id", "is", null)
  .returns<Singer[]>();
const rows = data ?? [];

type NInfo = { count: number; tokens: Set<string>; songs: Set<string> };
const names = new Map<string, NInfo>();
const songs = new Map<string, number>();

for (const r of rows) {
  if (!names.has(r.stage_name))
    names.set(r.stage_name, { count: 0, tokens: new Set(), songs: new Set() });
  const n = names.get(r.stage_name)!;
  n.count++;
  if (r.singer_token) n.tokens.add(r.singer_token.slice(0, 8));
  if (r.song) n.songs.add(r.song);
  songs.set(r.song, (songs.get(r.song) ?? 0) + 1);
}

const unmappedNames = [...names.entries()]
  .filter(([n]) => !isMappedSinger(n))
  .sort((a, b) => b[1].count - a[1].count);
const unmappedSongs = [...songs.entries()]
  .filter(([s]) => !isMappedSong(s))
  .sort((a, b) => b[1] - a[1]);

console.log(
  `Archive: ${rows.length} rows · ${names.size} raw names · ${songs.size} raw songs`,
);
console.log(
  `Unmapped: ${unmappedNames.length} name(s), ${unmappedSongs.length} song(s)\n`,
);

if (unmappedNames.length) {
  console.log("=== UNMAPPED NAMES (add to SINGER_ALIASES) ===");
  for (const [n, info] of unmappedNames) {
    console.log(
      `  ${String(info.count).padStart(2)}x  "${n}"` +
        (info.tokens.size ? `  tokens:${[...info.tokens].join(",")}` : "") +
        `\n        songs: ${[...info.songs].join(" | ")}`,
    );
  }
  console.log("");
}

if (unmappedSongs.length) {
  console.log("=== UNMAPPED SONGS (add to SONG_ALIASES) ===");
  for (const [s, c] of unmappedSongs)
    console.log(`  ${String(c).padStart(2)}x  "${s}"`);
  console.log("");
}

if (!unmappedNames.length && !unmappedSongs.length)
  console.log("✅ Everything is mapped. Stats are fully normalized.");

process.exit(0);
