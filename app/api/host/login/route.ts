import { NextResponse } from "next/server";
import { checkPassword, makeCookieValue, HOST_COOKIE_NAME } from "@/lib/host-auth";

export async function POST(req: Request) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/host");

  try {
    if (!checkPassword(password)) {
      return NextResponse.redirect(new URL("/host/login?error=bad", req.url), 303);
    }
  } catch (err) {
    console.error("login config error", err);
    return NextResponse.redirect(new URL("/host/login?error=server", req.url), 303);
  }

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
