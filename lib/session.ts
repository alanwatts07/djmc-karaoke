import { db } from "./supabase";

// Whether public submissions are currently accepted. Host toggles via the
// Begin/End night button on /host. Default is open so existing in-flight
// nights keep working after the migration.
export async function isSessionOpen(): Promise<boolean> {
  const { data, error } = await db
    .from("app_state")
    .select("session_open")
    .eq("id", "singleton")
    .maybeSingle<{ session_open: boolean }>();
  if (error) {
    console.error("session_open read failed", error);
    // Fail open — better to accept a stray submission than silently reject
    // everyone if the app_state row went missing.
    return true;
  }
  return data?.session_open ?? true;
}

export async function setSessionOpen(open: boolean): Promise<void> {
  const { error } = await db
    .from("app_state")
    .update({ session_open: open })
    .eq("id", "singleton");
  if (error) throw error;
}
