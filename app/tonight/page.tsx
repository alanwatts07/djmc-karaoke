import Link from "next/link";
import {
  getUpcomingEvents,
  formatEventDate,
  formatEventStart,
  KIND_META,
} from "@/lib/schedule";

// A self-contained "tonight" page: one cool, postable hero for TONIGHT's show
// (feed + story), with download links. No full schedule here on purpose — this
// is the single graphic the venue can repost. Does not touch the home page.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tonight — DJ MC Karaoke",
};

export default function TonightPage() {
  const event = getUpcomingEvents(1)[0];

  if (!event) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#2e0b52] via-[#86198f] to-[#0a0510] text-white flex flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="text-2xl font-bold">No show on the books right now.</p>
        <Link href="/" className="text-fuchsia-300 underline">
          Back home
        </Link>
      </main>
    );
  }

  const kind = KIND_META[event.kind];
  const dateLabel = formatEventDate(event.start);
  const isTonight = dateLabel === "Tonight";

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#2e0b52] via-[#86198f] to-[#0a0510] text-white">
      <div className="mx-auto max-w-lg px-5 py-10 flex flex-col items-center">
        <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-300 mb-1">
          {isTonight ? "Tonight" : "Next show"}
        </p>
        <h1 className="text-3xl font-extrabold text-center mb-1">
          {event.title ?? "Karaoke Night"}
        </h1>
        <p className="text-sm text-purple-200 mb-6 text-center">
          {dateLabel} · {formatEventStart(event.start)}–{event.endLabel} ·{" "}
          {event.venue}
        </p>

        {/* The postable hero — the venue can save/repost this directly */}
        <div className="w-full rounded-2xl overflow-hidden border border-white/15 shadow-2xl shadow-fuchsia-900/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/api/tonight-image"
            alt={`${event.venue} — ${dateLabel}`}
            width={1080}
            height={1080}
            className="w-full h-auto block"
          />
        </div>

        {/* Save / post actions */}
        <div className="w-full mt-6 flex flex-col gap-3">
          <a
            href="/api/tonight-image"
            download="tonight-square.png"
            className="w-full text-center rounded-xl bg-fuchsia-500 hover:bg-fuchsia-400 transition-colors px-5 py-3 font-semibold"
          >
            ⬇ Download for feed (square)
          </a>
          <a
            href="/api/tonight-image?format=story"
            download="tonight-story.png"
            className="w-full text-center rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 transition-colors px-5 py-3 font-semibold"
          >
            ⬇ Download for story (9:16)
          </a>
          <a
            href="/api/tonight-image"
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
