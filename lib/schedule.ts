// Hardcoded recurring residencies + one-off gigs, generated dynamically.
//
// TIMEZONE: all show times are Eastern (America/New_York) wall-clock. Vercel's
// servers run in UTC, so we must NOT rely on the server's local time — otherwise
// a Wednesday show shows as "Tonight" on Tuesday evening (Eastern), and times
// render hours off. Every date decision here goes through Eastern-time helpers.

// What kind of night it is. Drives the badge/label on the schedule. The app
// itself is still a karaoke-queue product — this is purely about display.
export type EventKind = "karaoke" | "dj" | "trivia";

export const KIND_META: Record<EventKind, { label: string; accent: string }> = {
  karaoke: { label: "Karaoke", accent: "#e879f9" }, // fuchsia
  dj: { label: "DJ Set", accent: "#f5b642" }, // amber
  trivia: { label: "Trivia", accent: "#22d3ee" }, // cyan
};

export type ScheduledEvent = {
  venue: string;
  city: string;
  start: Date; // absolute instant of the (Eastern) start time
  endLabel: string; // human-readable end ("12:00 AM"); shown as-is
  kind: EventKind;
  title?: string; // optional special-event name (e.g. a birthday / DJ gig)
  postponed?: boolean; // this specific night is off; still shown, tagged POSTPONED
  note?: string; // reason, revealed when the postponed event is tapped
};

type Residency = {
  venue: string;
  city: string;
  dayOfWeek: number; // 0 = Sun, 6 = Sat
  startHour: number; // 24h, Eastern
  startMinute: number;
  endLabel: string;
  kind?: EventKind; // defaults to "karaoke"
};

const RESIDENCIES: Residency[] = [
  {
    venue: "The Nerve",
    city: "Haverhill",
    dayOfWeek: 6, // Saturday
    startHour: 21, // 9:00 PM
    startMinute: 0,
    endLabel: "12:00 AM",
  },
  {
    venue: "Vault 77 Lounge",
    city: "Haverhill",
    dayOfWeek: 3, // Wednesday
    startHour: 21, // 9:00 PM
    startMinute: 0,
    endLabel: "11:00 PM",
  },
];

// Residency nights we're NOT doing karaoke — cancelled or the venue's booked.
// Keyed by Eastern YYYY-MM-DD; skipped, and the schedule rolls to the next night.
const BLACKOUT_DATES = new Set<string>([
  "2026-06-20", // Live show at The Nerve — no karaoke this Saturday
  "2026-07-04", // July 4th — no karaoke (holiday)
  "2026-07-11", // Moved to Fri Jul 10 this week — no Saturday karaoke
  "2026-08-22", // Away in Iceland (Aug 17–25) — no karaoke that Saturday
]);

// Residency nights that are POSTPONED (not silently removed): the night still
// shows in the list, tagged "Postponed", and tappable to reveal why. Keyed by
// Eastern YYYY-MM-DD → the reason shown to singers.
const POSTPONED_DATES = new Map<string, string>([
  [
    "2026-10-21",
    "No karaoke at Vault 77 this week — the venue is hosting a singles event 7–10 PM. Karaoke's back next Wednesday!",
  ],
]);

// One-off nights outside the weekly residencies. Times are Eastern wall-clock;
// `mon` is 1-based (June = 6). These merge into the upcoming list, sorted by date.
type OneOff = {
  venue: string;
  city: string;
  y: number;
  mon: number; // 1-based
  day: number;
  hh: number; // 24h Eastern
  mm: number;
  endLabel: string;
  kind?: EventKind; // defaults to "karaoke"
  title?: string; // optional special-event name (e.g. a birthday / DJ gig)
};

const ONE_OFF_EVENTS: OneOff[] = [
  { venue: "The Nerve", city: "Haverhill", y: 2026, mon: 6, day: 19, hh: 21, mm: 30, endLabel: "12:45 AM" },
  { venue: "The Nerve", city: "Haverhill", y: 2026, mon: 7, day: 10, hh: 21, mm: 30, endLabel: "12:45 AM" },
  { venue: "The Nerve", city: "Haverhill", y: 2026, mon: 7, day: 24, hh: 21, mm: 30, endLabel: "12:45 AM" },
  { venue: "The Nerve", city: "Haverhill", y: 2026, mon: 7, day: 31, hh: 20, mm: 30, endLabel: "12:00 AM" },
  { venue: "The Nerve", city: "Haverhill", y: 2026, mon: 8, day: 14, hh: 21, mm: 0, endLabel: "12:30 AM" },
  { venue: "The Vault", city: "Haverhill", y: 2026, mon: 9, day: 16, hh: 22, mm: 0, endLabel: "11:00 PM" },
  { venue: "The Nerve", city: "Haverhill", y: 2026, mon: 9, day: 25, hh: 21, mm: 0, endLabel: "12:00 AM" },
  { venue: "Vault 77 Lounge", city: "Haverhill", y: 2026, mon: 10, day: 2, hh: 20, mm: 0, endLabel: "Late", kind: "dj", title: "Jocelyn's Birthday · 80's Dance Party" },
];

// ── Eastern-time helpers (server-timezone-independent) ───────────────────────
const TZ = "America/New_York";
const pad = (n: number) => String(n).padStart(2, "0");

type EtParts = { y: number; m: number; d: number; hour: number; min: number };

// The Eastern wall-clock parts of an absolute instant.
function etParts(d: Date): EtParts {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(d)) if (p.type !== "literal") o[p.type] = p.value;
  let hour = parseInt(o.hour, 10);
  if (hour === 24) hour = 0; // some runtimes emit "24" for midnight
  return { y: +o.year, m: +o.month, d: +o.day, hour, min: +o.minute };
}

// Absolute instant for an Eastern wall-clock time (mon = 1-based). DST-safe.
function fromEastern(y: number, mon: number, day: number, hh: number, mm: number): Date {
  const target = Date.UTC(y, mon - 1, day, hh, mm);
  const offset = (ts: number) => {
    const p = etParts(new Date(ts));
    return Date.UTC(p.y, p.m - 1, p.d, p.hour, p.min) - ts;
  };
  // Correct twice so DST boundaries resolve.
  const ts1 = target - offset(target);
  const ts2 = target - offset(ts1);
  return new Date(ts2);
}

// Weekday (0=Sun) of an Eastern calendar date — noon UTC is the same calendar
// day everywhere, so this is a safe way to get the weekday of a Y-M-D.
function weekdayOf(y: number, mon: number, day: number): number {
  return new Date(Date.UTC(y, mon - 1, day, 12)).getUTCDay();
}

function nextDay(y: number, mon: number, day: number): [number, number, number] {
  const dt = new Date(Date.UTC(y, mon - 1, day, 12));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()];
}

// ── Public API ───────────────────────────────────────────────────────────────

// Next N shows across residencies + one-offs, soonest first. A show stays listed
// through a 6h grace window after it starts (so "Tonight" holds past midnight).
export function getUpcomingEvents(count = 3, from: Date = new Date()): ScheduledEvent[] {
  const GRACE = 6 * 60 * 60 * 1000;
  const events: ScheduledEvent[] = [];
  const today = etParts(from); // Eastern "today"

  for (const r of RESIDENCIES) {
    let [y, m, d] = [today.y, today.m, today.d];
    let collected = 0;
    let guard = 0;
    while (collected < count && guard < 400) {
      guard++;
      if (weekdayOf(y, m, d) === r.dayOfWeek) {
        const key = `${y}-${pad(m)}-${pad(d)}`;
        const start = fromEastern(y, m, d, r.startHour, r.startMinute);
        if (start.getTime() >= from.getTime() - GRACE && !BLACKOUT_DATES.has(key)) {
          const note = POSTPONED_DATES.get(key);
          events.push({
            venue: r.venue,
            city: r.city,
            start,
            endLabel: r.endLabel,
            kind: r.kind ?? "karaoke",
            ...(note ? { postponed: true, note } : {}),
          });
          collected++;
        }
      }
      [y, m, d] = nextDay(y, m, d);
    }
  }

  for (const e of ONE_OFF_EVENTS) {
    const start = fromEastern(e.y, e.mon, e.day, e.hh, e.mm);
    if (start.getTime() >= from.getTime() - GRACE) {
      events.push({ venue: e.venue, city: e.city, start, endLabel: e.endLabel, kind: e.kind ?? "karaoke", title: e.title });
    }
  }

  return events.sort((a, b) => a.start.getTime() - b.start.getTime()).slice(0, count);
}

export function formatEventDate(d: Date, now: Date = new Date()): string {
  const e = etParts(d);
  const n = etParts(now);
  if (e.y === n.y && e.m === n.m && e.d === n.d) return "Tonight";
  return d.toLocaleDateString("en-US", {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatEventStart(d: Date): string {
  const p = etParts(d);
  const h12 = ((p.hour + 11) % 12) + 1;
  const ampm = p.hour < 12 ? "AM" : "PM";
  return p.min === 0 ? `${h12} ${ampm}` : `${h12}:${pad(p.min)} ${ampm}`;
}
