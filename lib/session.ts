import { db } from "./supabase";

export type SessionState = {
  open: boolean;
  venue: string | null;
};

// Whether public submissions are currently accepted, and where tonight's
// gig is happening (set by the host on Begin night). Defaults to open if
// the app_state row goes missing.
export async function getSessionState(): Promise<SessionState> {
  const { data, error } = await db
    .from("app_state")
    .select("session_open, current_venue")
    .eq("id", "singleton")
    .maybeSingle<{ session_open: boolean; current_venue: string | null }>();
  if (error) {
    console.error("session state read failed", error);
    return { open: true, venue: null };
  }
  return {
    open: data?.session_open ?? true,
    venue: data?.current_venue ?? null,
  };
}

export async function isSessionOpen(): Promise<boolean> {
  return (await getSessionState()).open;
}

export async function setSessionOpen(
  open: boolean,
  venue?: string | null,
): Promise<void> {
  const update: { session_open: boolean; current_venue?: string | null } = {
    session_open: open,
  };
  // Only touch venue if the caller passed one. undefined means "leave alone",
  // null means "clear it explicitly", a string sets it.
  if (venue !== undefined) {
    update.current_venue = venue;
  }
  const { error } = await db
    .from("app_state")
    .update(update)
    .eq("id", "singleton");
  if (error) throw error;
}
