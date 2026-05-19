import { NextResponse } from "next/server";
import { HOST_COOKIE_NAME } from "@/lib/host-auth";

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/host/login", req.url), 303);
  res.cookies.delete(HOST_COOKIE_NAME);
  return res;
}
