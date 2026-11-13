import Link from "next/link";

// Venue-pitch flyer: preview + download of /api/flyer-image (live stats baked
// in at render time). Meant to be texted, emailed or printed for bar owners.
export const metadata = {
  title: "Flyer — DJ MC Karaoke",
};

export default function FlyerPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#2e0b52] via-[#86198f] to-[#0a0510] text-white">
      <div className="mx-auto max-w-lg px-5 py-10 flex flex-col items-center">
        <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-300 mb-1">
          For venues
        </p>
        <h1 className="text-3xl font-extrabold text-center mb-2">
          Why book DJ MC Karaoke
        </h1>
        <p className="text-sm text-purple-200 mb-6 text-center">
          Stats update automatically after every night.
        </p>

        <div className="w-full rounded-2xl overflow-hidden border border-white/15 shadow-2xl shadow-fuchsia-900/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/api/flyer-image"
            alt="DJ MC Karaoke venue flyer"
            width={1275}
            height={1650}
            className="w-full h-auto block"
          />
        </div>

        <div className="w-full mt-6 flex flex-col gap-3">
          <a
            href="/api/flyer-image"
            download="djmc-karaoke-flyer.png"
            className="w-full text-center rounded-xl bg-fuchsia-500 hover:bg-fuchsia-400 transition-colors px-5 py-3 font-semibold"
          >
            ⬇ Download flyer (prints on 8.5×11)
          </a>
          <a
            href="/api/flyer-image"
            target="_blank"
            rel="noreferrer"
            className="w-full text-center text-sm text-fuchsia-300 hover:text-fuchsia-200 underline underline-offset-4 py-1"
          >
            Open full-size image ↗
          </a>
        </div>

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
