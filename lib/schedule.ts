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
    startHour: 20,      // 8 PM
    startMinute: 0,
    endLabel: "12:45 AM",
  },
];

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

    for (let i = 0; i < count; i++) {
      events.push({
        venue: r.venue,
        city: r.city,
        start: new Date(cursor),
        endLabel: r.endLabel,
      });
      cursor.setDate(cursor.getDate() + 7);
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
