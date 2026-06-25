import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db, type Singer } from "@/lib/supabase";
import { ensureSingerToken, getSingerToken } from "@/lib/singer-token";
import { fairInterleave } from "@/lib/queue-ops";
import { getSessionState, isSessionOpen } from "@/lib/session";
import {
  getUpcomingEvents,
  formatEventDate,
  formatEventStart,
} from "@/lib/schedule";
import SubmitButton from "./submit-button";
import Footer from "./footer";

// Per-device limits. The 3-active cap is the primary defense against flooding
// (one phone can't pile up the queue); the hourly window is belt-and-suspenders
// for delete-and-resubmit cycling.
const MAX_ACTIVE_SONGS = 3;
const MAX_SUBMISSIONS_PER_HOUR = 6;

// Optional Spotify artist link. When set, a "Listen on Spotify" button shows
// on the splash so open-mic crowds scanning the QR can find DJ MC's music.
// NEXT_PUBLIC_ so it's inlined for the browser; hidden entirely if unset.
const SPOTIFY_URL = process.env.NEXT_PUBLIC_SPOTIFY_URL;

async function submit(formData: FormData) {
  "use server";

  // Hard gate: if the host hasn't opened the night yet, refuse the submission
  // entirely. Singers can still scan/visit the link — they just see the
  // "not open yet" screen.
  if (!(await isSessionOpen())) {
    redirect("/?error=closed");
  }

  const stage_name = String(formData.get("stage_name") ?? "").trim();
  const song = String(formData.get("song") ?? "").trim();

  if (!stage_name || stage_name.length > 60) {
    redirect("/?error=name");
  }
  if (!song || song.length > 120) {
    redirect("/?error=song");
  }

  const token = await ensureSingerToken();

  const { count: activeCount } = await db
    .from("singers")
    .select("id", { count: "exact", head: true })
    .eq("singer_token", token)
    .neq("status", "done");
  if ((activeCount ?? 0) >= MAX_ACTIVE_SONGS) {
    redirect("/?error=cap");
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: hourCount } = await db
    .from("singers")
    .select("id", { count: "exact", head: true })
    .eq("singer_token", token)
    .gte("submitted_at", hourAgo);
  if ((hourCount ?? 0) >= MAX_SUBMISSIONS_PER_HOUR) {
    redirect("/?error=rate");
  }

  const { error } = await db
    .from("singers")
    .insert({ stage_name, song, singer_token: token })
    .select("id")
    .single();

  if (error) {
    console.error("submit failed", error);
    redirect("/?error=server");
  }

  await fairInterleave();
  redirect("/me");
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; rename?: string; add?: string }>;
}) {
  const { error, rename, add } = await searchParams;

  // Look up the cookie FIRST — we need knownName for both the closed-state
  // setlist link and the open-state form pre-fill.
  let knownName = "";
  const token = await getSingerToken();
  if (token && !rename) {
    const { data } = await db
      .from("singers")
      .select("stage_name")
      .eq("singer_token", token)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle<Pick<Singer, "stage_name">>();
    if (data) knownName = data.stage_name;
  }

  const { open: sessionOpen, venue } = await getSessionState();

  // Closed: render the promo splash. If the visitor is a returning singer,
  // give them a button into their setlist so they don't think we forgot them.
  if (!sessionOpen) {
    return (
      <main className="flex-1 flex flex-col items-center p-6 pt-12 bg-gradient-to-b from-purple-950 via-fuchsia-900 to-black text-white">
        <div className="w-full max-w-sm text-center">
          <Image
            src="/djmc-logo.png"
            alt="DJ MC Karaoke"
            width={240}
            height={240}
            priority
            className="mx-auto mb-6 h-56 w-56 drop-shadow-[0_10px_30px_rgba(236,72,153,0.45)]"
          />

          <p className="text-xs uppercase tracking-[0.35em] text-fuchsia-300 mb-1">
            Karaoke Night
          </p>
          <h1 className="text-5xl font-extrabold tracking-tight mb-3">
            with <span className="text-fuchsia-400">DJ MC</span>
          </h1>

          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-purple-100 mb-6 border border-white/15">
            <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
            Sign-ups open when the night kicks off
          </div>

          {SPOTIFY_URL && (
            <a
              href={SPOTIFY_URL}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-semibold py-3 mb-8 transition no-underline"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-5 w-5 fill-current"
              >
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.5 17.31c-.22.36-.68.47-1.04.25-2.85-1.74-6.43-2.13-10.65-1.17-.41.09-.82-.16-.92-.57-.09-.41.16-.82.57-.92 4.62-1.06 8.58-.6 11.78 1.35.36.22.47.68.25 1.06zm1.47-3.27c-.27.45-.86.59-1.31.31-3.26-2-8.23-2.58-12.09-1.41-.5.15-1.04-.13-1.19-.63-.15-.5.13-1.04.63-1.19 4.41-1.34 9.89-.69 13.64 1.61.45.27.59.86.31 1.31zm.13-3.4C15.69 8.21 8.99 7.98 5.1 9.16c-.6.18-1.24-.16-1.42-.76-.18-.6.16-1.24.76-1.42 4.47-1.36 11.87-1.09 16.05 1.39.54.32.72 1.02.4 1.56-.32.54-1.02.72-1.56.4z" />
              </svg>
              Listen on Spotify
            </a>
          )}

          {knownName ? (
            <>
              <p className="text-purple-200 text-base leading-relaxed mb-4 max-w-xs mx-auto">
                Hey {knownName} — your setlist from previous nights is still
                here. Tap below to see it.
              </p>
              <Link
                href="/me"
                className="block w-full rounded-lg bg-white text-purple-900 hover:bg-purple-100 font-semibold py-3 mb-8"
              >
                View your setlist
              </Link>
            </>
          ) : (
            <p className="text-purple-200 text-base leading-relaxed mb-8 max-w-xs mx-auto">
              You're early — or it's a different night. Catch the next show:
            </p>
          )}

          {(() => {
            const events = getUpcomingEvents(3);
            return (
              <div className="text-left space-y-2 mb-8">
                <p className="text-xs uppercase tracking-[0.2em] text-fuchsia-300 text-center mb-3">
                  Upcoming shows
                </p>
                {events.map((e, i) => (
                  <div
                    key={i}
                    className="flex items-baseline justify-between gap-3 rounded-lg bg-white/5 border border-white/10 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">
                        {formatEventDate(e.start)}
                      </p>
                      <p className="text-xs text-purple-300 truncate">
                        {e.venue} · {e.city}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs text-white/80">
                      {formatEventStart(e.start)}–{e.endLabel}
                    </p>
                  </div>
                ))}
              </div>
            );
          })()}

          <Footer />
        </div>
      </main>
    );
  }

  // Open + returning singer: bounce them to /me so they see their setlist
  // (with history across past nights) by default. Bypass with ?add=1.
  if (knownName && add === undefined && error === undefined) {
    redirect("/me");
  }

  const errorMessage =
    error === "name"
      ? "Stage name is required (max 60 chars)."
      : error === "song"
        ? "Song is required (max 120 chars)."
        : error === "cap"
          ? `You already have ${MAX_ACTIVE_SONGS} songs in your setlist. Wait for one to finish before adding another.`
          : error === "rate"
            ? "Whoa — that's a lot of submissions. Take a breather and try again in a bit."
            : error === "closed"
              ? "Sign-ups just closed. Catch you next time."
              : error === "server"
                ? "Couldn't submit. Try again."
                : null;

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-purple-950 via-fuchsia-900 to-black text-white">
      <div className="w-full max-w-sm">
        {knownName && (
          <a
            href="/me"
            className="block text-center text-sm text-purple-200 hover:text-white underline mb-4"
          >
            ← Back to your setlist
          </a>
        )}

        <Image
          src="/djmc-logo.png"
          alt="DJ MC Karaoke"
          width={180}
          height={180}
          priority
          className="mx-auto mb-4 h-40 w-40 drop-shadow-[0_8px_24px_rgba(236,72,153,0.35)]"
        />

        <div className="flex justify-center mb-4">
          <span
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300 border border-emerald-500/30"
            title="Sign-ups are open"
          >
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            Live{venue ? ` at ${venue}` : ""}
          </span>
        </div>

        <h1 className="text-4xl font-bold tracking-tight text-center mb-2">
          {knownName ? `Hey, ${knownName}` : "Get on the mic"}
        </h1>
        <p className="text-center text-purple-200 mb-8">
          {knownName
            ? "Queue up another song."
            : "Drop your name and song. We'll call you up."}
        </p>

        <form action={submit} className="space-y-4">
          {knownName ? (
            <input type="hidden" name="stage_name" value={knownName} />
          ) : (
            <label className="block">
              <span className="block text-sm font-medium mb-1 text-purple-100">
                Stage name
              </span>
              <input
                name="stage_name"
                required
                maxLength={60}
                autoComplete="off"
                autoCapitalize="words"
                className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-400"
                placeholder="What should we call you?"
              />
            </label>
          )}

          <label className="block">
            <span className="block text-sm font-medium mb-1 text-purple-100">
              Song
            </span>
            <input
              name="song"
              required
              maxLength={120}
              autoComplete="off"
              className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-400"
              placeholder="Artist - Song title"
            />
          </label>

          {errorMessage && (
            <p className="text-sm text-rose-300 bg-rose-950/50 rounded p-2">
              {errorMessage}
            </p>
          )}

          <SubmitButton />
        </form>

        {knownName && (
          <p className="text-center text-xs text-purple-300/70 mt-4">
            Not {knownName}?{" "}
            <Link href="/?rename=1" className="underline">
              use a different name
            </Link>
          </p>
        )}

        <p className="text-center text-xs text-purple-300/70 mt-8">
          Tips appreciated, never required.
          <br />
          Drop a tip with your stage name in the memo to expedite your song.
        </p>

        <Footer
          singerName={knownName || undefined}
          promptForName={!knownName}
        />
      </div>
    </main>
  );
}
