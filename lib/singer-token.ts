import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

const COOKIE = "karaoke_singer";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function getSingerToken(): Promise<string | null> {
  const store = await cookies();
  const v = store.get(COOKIE)?.value;
  return v && UUID_RE.test(v) ? v : null;
}

// Reads the token if it exists, otherwise mints a new one and writes the
// cookie. Only callable from a Server Function or Route Handler.
export async function ensureSingerToken(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE)?.value;
  if (existing && UUID_RE.test(existing)) return existing;

  const token = randomUUID();
  store.set({
    name: COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
  return token;
}

export const SINGER_COOKIE_NAME = COOKIE;
