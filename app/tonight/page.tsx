import Link from "next/link";
import {
  getUpcomingEvents,
  formatEventDate,
  formatEventStart,
  KIND_META,
} from "@/lib/schedule";

// A self-contained "tonight" page: a cool, postable hero for any upcoming show
// (feed + story), with download links. A picker lets the host choose WHICH
// upcoming night to make a graphic for; the hero says "Tonight" only when it's
// today, otherwise the date. Does not touch the home page.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tonight — DJ MC Karaoke",
};

export default async function TonightPage({
  searchParams,
}: {
  searchParams: Promise<{ i?: string }>;
}) {
  const { i } = await searchParams;
  const upcoming = getUpcomingEvents(6);

  if (upcoming.length === 0) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#2e0b52] via-[#86198f] to-[#0a0510] text-white flex flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="text-2xl font-bold">No show on the books right now.</p>
        <Link href="/" className="text-fuchsia-300 underline">
          Back home
        </Link>
      </main>
    );
  }

  const idx = Math.min(Math.max(0, parseInt(i ?? "0", 10) || 0), upcoming.length - 1);
  const event = upcoming[idx];
  const kind = KIND_META[event.kind];
  const dateLabel = formatEventDate(event.start);
  const isTonight = dateLabel === "Tonight";
  const imgQ = idx > 0 ? `?i=${idx}` : "";
  const storyQ = idx > 0 ? `?i=${idx}&format=story` : "?format=story";

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#2e0b52] via-[#86198f] to-[#0a0510] text-white">
      <div className="mx-auto max-w-lg px-5 py-10 flex flex-col items-center">
        {/* Picker — choose which upcoming show to make a graphic for */}
        {upcoming.length > 1 && (
          <div className="w-full mb-6 flex flex-wrap justify-center gap-2">
            {upcoming.map((ev, n) => {
              const lbl = formatEventDate(ev.start);
              return (
                <Link
                  key={n}
                  href={n === 0 ? "/tonight" : `/tonight?i=${n}`}
                  scroll={false}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    n === idx
                      ? "bg-fuchsia-500 text-white"
                      : "bg-white/10 text-purple-200 hover:bg-white/20"
                  }`}
                >
                  {lbl}
                  {ev.postponed ? " · ✕" : ""}
                </Link>
              );
            })}
          </div>
        )}

        <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-300 mb-1">
          {isTonight ? "Tonight" : "Upcoming show"}
        </p>
        <h1 className="text-3xl font-extrabold text-center mb-1">
          {event.title ?? "Karaoke Night"}
        </h1>
        <p className="text-sm text-purple-200 mb-2 text-center">
          {dateLabel} ·{" "}
          {event.postponed
            ? "Postponed"
            : `${formatEventStart(event.start)}–${event.endLabel}`}{" "}
          · {event.venue}
        </p>
        {event.postponed && event.note && (
          <p className="text-sm text-amber-200 mb-6 text-center max-w-sm">
            {event.note}
          </p>
        )}
        {!event.postponed && <div className="mb-6" />}

        {/* The postable hero — the venue can save/repost this directly */}
        <div className="w-full rounded-2xl overflow-hidden border border-white/15 shadow-2xl shadow-fuchsia-900/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/tonight-image${imgQ}`}
            alt={`${event.venue} — ${dateLabel}`}
            width={1080}
            height={1080}
            className="w-full h-auto block"
          />
        </div>

        {/* Save / post actions */}
        <div className="w-full mt-6 flex flex-col gap-3">
          <a
            href={`/api/tonight-image${imgQ}`}
            download="show-square.png"
            className="w-full text-center rounded-xl bg-fuchsia-500 hover:bg-fuchsia-400 transition-colors px-5 py-3 font-semibold"
          >
            ⬇ Download for feed (square)
          </a>
          <a
            href={`/api/tonight-image${storyQ}`}
            download="show-story.png"
            className="w-full text-center rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 transition-colors px-5 py-3 font-semibold"
          >
            ⬇ Download for story (9:16)
          </a>
          <a
            href={`/api/tonight-image${imgQ}`}
            target="_blank"
            rel="noreferrer"
            className="w-full text-center text-sm text-fuchsia-300 hover:text-fuchsia-200 underline underline-offset-4 py-1"
          >
            Open full-size image ↗
          </a>
        </div>

        <span
          className="mt-8 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide"
          style={{
            color: kind.accent,
            borderColor: `${kind.accent}66`,
            backgroundColor: `${kind.accent}1a`,
          }}
        >
          {kind.label}
        </span>

        <Link
          href="/"
          className="mt-8 text-sm text-purple-300 hover:text-purple-200 underline underline-offset-4"
        >
          ← Back home
        </Link>
      </div>
    </main>
  );
}
