// Per-singer and per-song stats, aggregated across all archived nights.
//
// Reads archived singer rows (night_id set), resolves each raw name/song to its
// canonical form via lib/stats/normalize, and rolls up counts. A sign-up counts
// as "sung" only if started_singing_at is set. Duets credit each member.

import { db, type Singer } from "@/lib/supabase";
import { canonicalSingers, canonicalSong } from "./normalize";

export type SingerStat = {
  name: string;
  sung: number; // total songs performed (duets count for each member)
  signups: number; // total sign-ups (sung or not)
  nights: number; // distinct nights they performed on
  songs: { title: string; count: number }[]; // their repertoire, most-sung first
};

export type SongStat = {
  title: string;
  timesSung: number;
  singers: { name: string; count: number }[]; // who sang it, most first
};

export type StatsBundle = {
  singers: SingerStat[];
  songs: SongStat[];
  totalPerformances: number; // sung rows (not member-expanded)
};

export async function computeStats(): Promise<StatsBundle> {
  const { data } = await db
    .from("singers")
    .select("*")
    .not("night_id", "is", null)
    .returns<Singer[]>();
  return aggregate(data ?? []);
}

// Pure aggregation — separated so it can be unit-tested with synthetic rows.
export function aggregate(rows: Singer[]): StatsBundle {
  type SAcc = {
    sung: number;
    signups: number;
    nights: Set<string>;
    songs: Map<string, number>;
  };
  type SoAcc = { timesSung: number; singers: Map<string, number> };

  const singers = new Map<string, SAcc>();
  const songs = new Map<string, SoAcc>();
  let totalPerformances = 0;

  for (const r of rows) {
    const people = canonicalSingers(r.stage_name, r.singer_token);
    const song = canonicalSong(r.song);
    const didSing = r.started_singing_at !== null;
    if (didSing) totalPerformances++;

    // Per-singer: credit each member (a duet counts for everyone in it).
    for (const person of people) {
      let s = singers.get(person);
      if (!s) {
        s = { sung: 0, signups: 0, nights: new Set(), songs: new Map() };
        singers.set(person, s);
      }
      s.signups++;
      if (didSing) {
        s.sung++;
        if (r.night_id) s.nights.add(r.night_id);
        s.songs.set(song, (s.songs.get(song) ?? 0) + 1);
      }
    }

    // Per-song: count the PERFORMANCE once (a group singing together is one
    // performance), but list every member who was part of it.
    if (didSing) {
      let so = songs.get(song);
      if (!so) {
        so = { timesSung: 0, singers: new Map() };
        songs.set(song, so);
      }
      so.timesSung++;
      for (const person of people)
        so.singers.set(person, (so.singers.get(person) ?? 0) + 1);
    }
  }

  const singerStats: SingerStat[] = [...singers.entries()]
    .map(([name, s]) => ({
      name,
      sung: s.sung,
      signups: s.signups,
      nights: s.nights.size,
      songs: [...s.songs.entries()]
        .map(([title, count]) => ({ title, count }))
        .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => b.sung - a.sung || a.name.localeCompare(b.name));

  const songStats: SongStat[] = [...songs.entries()]
    .map(([title, so]) => ({
      title,
      timesSung: so.timesSung,
      singers: [...so.singers.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    }))
    .sort(
      (a, b) => b.timesSung - a.timesSung || a.title.localeCompare(b.title),
    );

  return { singers: singerStats, songs: songStats, totalPerformances };
}
