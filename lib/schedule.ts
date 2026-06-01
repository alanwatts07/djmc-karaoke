// Hardcoded recurring residencies. For v1, just the weekly Saturday at
// The Nerve. If/when DJ MC picks up more residencies or one-off gigs,
// turn this into a real events table — but for one venue + one recurring
// night, dynamic generation is plenty.

export type ScheduledEvent = {
  venue: string;
  city: string;
  start: Date;          // Local time the doors open / show starts
  endLabel: string;     // Human-readable end ("12:45 AM"); used as-is, no tz math
};

type Residency = {
  venue: string;
  city: string;
  dayOfWeek: number;    // 0 = Sun, 6 = Sat
  startHour: number;    // 24h, local
  startMinute: number;
  endLabel: string;
};

const RESIDENCIES: Residency[] = [
  {
    venue: "The Nerve",
    city: "Haverhill",
    dayOfWeek: 6,       // Saturday
    startHour: 21,      // 9:30 PM
    startMinute: 30,
    endLabel: "12:45 AM",
  },
];

// Residency nights we're NOT doing karaoke — cancelled, or the venue has
// something else booked (a live show, private event, etc). Keyed by local
// YYYY-MM-DD. These dates are skipped and the schedule rolls to the next
// real karaoke night.
const BLACKOUT_DATES = new Set<string>([
  "2026-06-20", // Live show at The Nerve — no karaoke this Saturday
]);

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Returns the next N occurrences across all residencies, sorted soonest first.
// Includes today if today matches a residency day (handy for "tonight"
// after the gig has started but before midnight).
export function getUpcomingEvents(count = 3, from: Date = new Date()): ScheduledEvent[] {
  const events: ScheduledEvent[] = [];

  for (const r of RESIDENCIES) {
    const cursor = new Date(from);
    cursor.setHours(r.startHour, r.startMinute, 0, 0);

    // Walk to next matching weekday (today counts if it matches).
    while (cursor.getDay() !== r.dayOfWeek || cursor.getTime() < from.getTime() - 6 * 60 * 60 * 1000) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(r.startHour, r.startMinute, 0, 0);
      if (cursor.getDay() !== r.dayOfWeek) continue;
      if (cursor.getTime() >= from.getTime() - 6 * 60 * 60 * 1000) break;
    }

    // Collect `count` occurrences, skipping any blackout dates and rolling
    // forward to the next real night. Guard caps the walk at ~1 year so a
    // misconfiguration can never spin forever.
    let collected = 0;
    let guard = 0;
    while (collected < count && guard < count + 52) {
      if (!BLACKOUT_DATES.has(dateKey(cursor))) {
        events.push({
          venue: r.venue,
          city: r.city,
          start: new Date(cursor),
          endLabel: r.endLabel,
        });
        collected++;
      }
      cursor.setDate(cursor.getDate() + 7);
      guard++;
    }
  }

  return events
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, count);
}

export function formatEventDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatEventStart(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: d.getMinutes() === 0 ? undefined : "2-digit",
  });
}
