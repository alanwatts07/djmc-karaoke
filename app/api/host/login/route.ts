import { NextResponse } from "next/server";
import { checkPassword, makeCookieValue, HOST_COOKIE_NAME } from "@/lib/host-auth";

// In-memory per-IP brute-force lockout. Survives within a single serverless
// instance — on Vercel each region has its own counter, so this isn't a
// distributed guarantee. For a bar-night scenario (single venue, one host
// machine, ~one region serving the page) it's enough to defeat the obvious
// "loop the curl from venue wifi" attack.
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MS = 60_000;
const ATTEMPTS = new Map<string, { fails: number; blockedUntil: number }>();

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function isBlocked(ip: string): boolean {
  const rec = ATTEMPTS.get(ip);
  if (!rec) return false;
  if (rec.blockedUntil > Date.now()) return true;
  if (rec.blockedUntil > 0) ATTEMPTS.delete(ip);
  return false;
}

function recordFail(ip: string): void {
  const rec = ATTEMPTS.get(ip) ?? { fails: 0, blockedUntil: 0 };
  rec.fails++;
  if (rec.fails >= LOCKOUT_THRESHOLD) {
    rec.blockedUntil = Date.now() + LOCKOUT_MS;
    rec.fails = 0;
  }
  ATTEMPTS.set(ip, rec);
}

function recordSuccess(ip: string): void {
  ATTEMPTS.delete(ip);
}

export async function POST(req: Request) {
  const ip = clientIp(req);

  if (isBlocked(ip)) {
    return NextResponse.redirect(
      new URL("/host/login?error=locked", req.url),
      303,
    );
  }

  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/host");

  try {
    if (!checkPassword(password)) {
      recordFail(ip);
      return NextResponse.redirect(new URL("/host/login?error=bad", req.url), 303);
    }
  } catch (err) {
    console.error("login config error", err);
    return NextResponse.redirect(new URL("/host/login?error=server", req.url), 303);
  }

  recordSuccess(ip);

  // Only redirect to internal paths.
  const safeNext = next.startsWith("/") ? next : "/host";
  const res = NextResponse.redirect(new URL(safeNext, req.url), 303);
  res.cookies.set({
    name: HOST_COOKIE_NAME,
    value: makeCookieValue(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // a week
  });
  return res;
}
