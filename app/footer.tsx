import TipButton from "./tip-button";

// Personal contact info pulled from env so the public repo stays generic.
// Set NEXT_PUBLIC_* values in your Vercel project (or .env.local for dev)
// to override the placeholders. NEXT_PUBLIC_ means they're inlined at build
// time and exposed to the browser — that's correct here since these end up
// rendered in HTML anyway.
const VENMO = process.env.NEXT_PUBLIC_VENMO_HANDLE ?? "your-venmo-handle";
const INSTAGRAM =
  process.env.NEXT_PUBLIC_INSTAGRAM_HANDLE ?? "your-instagram";
const WEBSITE = process.env.NEXT_PUBLIC_WEBSITE ?? "your-site.com";
const BOOKING_EMAIL =
  process.env.NEXT_PUBLIC_BOOKING_EMAIL ?? "you@example.com";
const RADIO_URL =
  process.env.NEXT_PUBLIC_RADIO_URL ?? `https://${WEBSITE}`;
const DJ_NAME = process.env.NEXT_PUBLIC_DJ_NAME ?? "DJ MC";

export default function Footer({
  singerName,
  promptForName,
}: {
  singerName?: string;
  promptForName?: boolean;
}) {
  return (
    <footer className="w-full mt-10 pt-5 border-t border-white/10 text-center text-xs text-white/60 space-y-3">
      <p>
        Hosted by{" "}
        <span className="font-semibold text-white/80">{DJ_NAME}</span>
      </p>

      <TipButton
        venmoHandle={VENMO}
        singerName={singerName}
        readNameFromInput={promptForName}
      />

      <div className="pt-1">
        <a
          href={RADIO_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-5 py-2 transition no-underline"
        >
          🎧 Not karaoke? Request a track for the DJ
        </a>
      </div>

      <div className="pt-1">
        <a
          href={`mailto:${BOOKING_EMAIL}?subject=${encodeURIComponent(`Book ${DJ_NAME} for an event`)}`}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold text-sm px-5 py-2 transition no-underline"
        >
          📅 Book {DJ_NAME} for your event
        </a>
      </div>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-1">
        <a
          href={`https://instagram.com/${INSTAGRAM}`}
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-white"
        >
          @{INSTAGRAM}
        </a>
        <a
          href={`https://${WEBSITE}`}
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-white"
        >
          {WEBSITE}
        </a>
      </div>

      <p className="text-white/40 italic">
        Custom karaoke software by {DJ_NAME}.{" "}
        <a
          href={`https://${WEBSITE}`}
          className="underline hover:text-white/60"
        >
          Need something built?
        </a>
      </p>
    </footer>
  );
}
