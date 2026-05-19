import { NextResponse, type NextRequest } from "next/server";
import { isValidCookieValue, HOST_COOKIE_NAME } from "@/lib/host-auth";

// Gate /host/* (except /host/login) behind the host cookie. Per the Next.js 16
// docs, proxy is *not* sufficient on its own for auth — every host API route
// also calls `isHostAuthed()` itself.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/host/login" || pathname === "/api/host/login") {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(HOST_COOKIE_NAME)?.value;
  if (isValidCookieValue(cookie)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/host")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/host/login";
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/host/:path*", "/api/host/:path*"],
};
