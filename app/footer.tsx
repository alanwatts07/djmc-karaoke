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
// Optional Spotify artist link. Shown under the tip button so open-mic crowds
// scanning the QR can find DJ MC's music. Hidden entirely when unset.
const SPOTIFY_URL = process.env.NEXT_PUBLIC_SPOTIFY_URL;

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

      {SPOTIFY_URL && (
        <div className="pt-1">
          <a
            href={SPOTIFY_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-semibold text-sm px-5 py-2 transition no-underline"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-4 w-4 fill-current"
            >
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.5 17.31c-.22.36-.68.47-1.04.25-2.85-1.74-6.43-2.13-10.65-1.17-.41.09-.82-.16-.92-.57-.09-.41.16-.82.57-.92 4.62-1.06 8.58-.6 11.78 1.35.36.22.47.68.25 1.06zm1.47-3.27c-.27.45-.86.59-1.31.31-3.26-2-8.23-2.58-12.09-1.41-.5.15-1.04-.13-1.19-.63-.15-.5.13-1.04.63-1.19 4.41-1.34 9.89-.69 13.64 1.61.45.27.59.86.31 1.31zm.13-3.4C15.69 8.21 8.99 7.98 5.1 9.16c-.6.18-1.24-.16-1.42-.76-.18-.6.16-1.24.76-1.42 4.47-1.36 11.87-1.09 16.05 1.39.54.32.72 1.02.4 1.56-.32.54-1.02.72-1.56.4z" />
            </svg>
            Listen on Spotify
          </a>
        </div>
      )}

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
