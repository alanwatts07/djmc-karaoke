import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db, type Singer } from "@/lib/supabase";
import { ensureSingerToken, getSingerToken } from "@/lib/singer-token";
import { fairInterleave } from "@/lib/queue-ops";
import SubmitButton from "./submit-button";
import Footer from "./footer";

// Per-device limits. The 3-active cap is the primary defense against flooding
// (one phone can't pile up the queue); the hourly window is belt-and-suspenders
// for delete-and-resubmit cycling.
const MAX_ACTIVE_SONGS = 3;
const MAX_SUBMISSIONS_PER_HOUR = 6;

async function submit(formData: FormData) {
  "use server";

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

  // If we recognize the singer (cookie + previous row), skip the name input
  // and use the stored name. They can hit "not me?" to reset.
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

    // Returning singer with songs still in play — bounce them to /me so they
    // see their setlist by default instead of the submit form. Bypass with
    // ?add=1 (the "+ Add another song" button passes that).
    if (knownName && add === undefined && error === undefined) {
      const { data: active } = await db
        .from("singers")
        .select("id")
        .eq("singer_token", token)
        .neq("status", "done")
        .limit(1)
        .maybeSingle();
      if (active) redirect("/me");
    }
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
