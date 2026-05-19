import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "karaoke_host";

function getSecret(): string {
  const secret = process.env.HOST_COOKIE_SECRET;
  if (!secret || secret === "change-me-to-a-long-random-string") {
    throw new Error(
      "HOST_COOKIE_SECRET is not set. Set it to a long random string in .env.local.",
    );
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

// Cookie format: "<issued-at-ms>.<hex-hmac>". A bit of light tamper resistance;
// the only fact the cookie asserts is "this browser knew the password at time T".
export function makeCookieValue(): string {
  const issued = Date.now().toString();
  return `${issued}.${sign(issued)}`;
}

export function isValidCookieValue(value: string | undefined): boolean {
  if (!value) return false;
  const [issued, mac] = value.split(".");
  if (!issued || !mac) return false;
  const expected = sign(issued);
  if (expected.length !== mac.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(mac, "hex"));
  } catch {
    return false;
  }
}

export async function isHostAuthed(): Promise<boolean> {
  const store = await cookies();
  return isValidCookieValue(store.get(COOKIE_NAME)?.value);
}

export const HOST_COOKIE_NAME = COOKIE_NAME;

export function checkPassword(submitted: string): boolean {
  const expected = process.env.HOST_PASSWORD;
  if (!expected || expected === "change-me") {
    throw new Error(
      "HOST_PASSWORD is not set. Set it in .env.local before logging in.",
    );
  }
  if (submitted.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(submitted), Buffer.from(expected));
}
