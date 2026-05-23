import TipButton from "./tip-button";

const VENMO = "therealalanwatts";
const INSTAGRAM = "mattyshack7";
const WEBSITE = "mattcorwin.dev";

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
        Hosted by <span className="font-semibold text-white/80">DJ MC</span>
      </p>

      <TipButton
        venmoHandle={VENMO}
        singerName={singerName}
        readNameFromInput={promptForName}
      />

      <div className="pt-1">
        <a
          href="https://radio.mattcorwin.dev"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-5 py-2 transition no-underline"
        >
          🎧 Not karaoke? Request a track for the DJ
        </a>
      </div>

      <div className="pt-1">
        <a
          href="mailto:me@mattcorwin.dev?subject=Book%20DJ%20MC%20for%20an%20event"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold text-sm px-5 py-2 transition no-underline"
        >
          📅 Book DJ MC for your event
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
        Custom karaoke software by DJ MC.{" "}
        <a href={`https://${WEBSITE}`} className="underline hover:text-white/60">
          Need something built?
        </a>
      </p>
    </footer>
  );
}
