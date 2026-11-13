// Live numbers for the venue-pitch flyer (/flyer + /api/flyer-image), rolled up
// from archived nights + singer rows. Aggregates only — no names, notes or tips.

import { db, type Night } from "@/lib/supabase";
import { computeStats } from "@/lib/stats/aggregate";

export type FlyerStats = {
  nights: number; // archived nights, all venues
  performances: number; // songs actually sung
  uniqueSingers: number; // distinct people who sang at least once
  regulars: number; // sang on 3+ different nights
  avgSignups: number; // per night, nights with a real crowd (see below)
  bestNight: number; // most sign-ups in one night
  avgHours: number; // average length of a night, start of first song → last
};

// A night cut short (started late, rained out, etc.) drags the averages down
// without saying anything about the crowd — skip anything under an hour.
const MIN_NIGHT_SECONDS = 60 * 60;

export async function getFlyerStats(): Promise<FlyerStats> {
  const [{ data }, stats] = await Promise.all([
    db.from("nights").select("*").returns<Night[]>(),
    computeStats(),
  ]);
  const nights = data ?? [];
  const full = nights.filter(
    (n) => (n.duration_seconds ?? 0) >= MIN_NIGHT_SECONDS,
  );
  const sung = stats.singers.filter((s) => s.sung > 0);
  const avg = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

  return {
    nights: nights.length,
    performances: stats.totalPerformances,
    uniqueSingers: sung.length,
    regulars: sung.filter((s) => s.nights >= 3).length,
    avgSignups: Math.round(avg(full.map((n) => n.total_signups))),
    bestNight: Math.max(0, ...nights.map((n) => n.total_signups)),
    avgHours:
      Math.round(avg(full.map((n) => n.duration_seconds ?? 0)) / 360) / 10,
  };
}
