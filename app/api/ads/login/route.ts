import { NextResponse } from "next/server";
import {
  GATE_COOKIE,
  passwordConfigured,
  passwordsMatch,
  requestIsSecure,
  sessionCookieOptions,
  signSession,
} from "@/lib/ads/password-gate";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!passwordConfigured()) {
    return NextResponse.json({ error: "Portal password is not configured." }, { status: 503 });
  }
  let password = "";
  try {
    const body = (await request.json()) as { password?: unknown };
    if (typeof body.password === "string") password = body.password;
  } catch {
    password = "";
  }
  if (!passwordsMatch(password)) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  const token = signSession();
  if (!token) {
    return NextResponse.json({ error: "Portal password is not configured." }, { status: 503 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: GATE_COOKIE,
    value: token,
    ...sessionCookieOptions,
    secure: requestIsSecure(request),
  });
  return response;
}
