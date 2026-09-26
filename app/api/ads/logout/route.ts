import { NextResponse } from "next/server";
import { GATE_COOKIE, requestIsSecure, sessionCookieOptions } from "@/lib/ads/password-gate";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: GATE_COOKIE,
    value: "",
    httpOnly: sessionCookieOptions.httpOnly,
    sameSite: sessionCookieOptions.sameSite,
    path: sessionCookieOptions.path,
    maxAge: 0,
    secure: requestIsSecure(request),
  });
  return response;
}
