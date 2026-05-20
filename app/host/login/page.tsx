export default async function HostLogin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 bg-zinc-950 text-zinc-100">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold mb-1">Host login</h1>
        <p className="text-zinc-400 text-sm mb-6">
          Password is set via the <code>HOST_PASSWORD</code> env var.
        </p>

        <form action="/api/host/login" method="post" className="space-y-4">
          <input type="hidden" name="next" value={next ?? "/host"} />
          <input
            type="password"
            name="password"
            required
            autoFocus
            placeholder="Password"
            className="w-full rounded bg-zinc-900 border border-zinc-800 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
          />

          {error === "bad" && (
            <p className="text-rose-400 text-sm">Wrong password.</p>
          )}
          {error === "locked" && (
            <p className="text-rose-400 text-sm">
              Too many failed attempts. Try again in about a minute.
            </p>
          )}
          {error === "server" && (
            <p className="text-rose-400 text-sm">
              Server error. Check that HOST_PASSWORD and HOST_COOKIE_SECRET are set.
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded bg-fuchsia-600 hover:bg-fuchsia-500 py-3 font-medium"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
