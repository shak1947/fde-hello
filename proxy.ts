import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, verifySession } from "@/lib/ads/password-gate";

function hasSession(request: NextRequest): boolean {
  return verifySession(request.cookies.get(GATE_COOKIE)?.value);
}

function isPublicAdsApi(pathname: string): boolean {
  return pathname === "/api/ads/login" || pathname === "/api/ads/logout" || pathname === "/api/ads/health";
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = (request.headers.get("host") || request.nextUrl.host || "").split(":")[0];

  if (pathname === "/") {
    if (!host.startsWith("ads.")) {
      const url = request.nextUrl.clone();
      url.pathname = "/legacy-home.html";
      return NextResponse.rewrite(url);
    }
    if (!hasSession(request)) {
      const url = request.nextUrl.clone();
      url.pathname = "/ads/enter";
      url.search = "";
      return NextResponse.redirect(url);
    }
    const url = request.nextUrl.clone();
    url.pathname = "/ads";
    return NextResponse.rewrite(url);
  }

  const adsPage = pathname === "/ads" || pathname.startsWith("/ads/");
  const adsApi = pathname === "/api/ads" || pathname.startsWith("/api/ads/");
  if (!adsPage && !adsApi) return NextResponse.next();

  if (pathname === "/ads/enter" || pathname.startsWith("/ads/enter/")) {
    if (!hasSession(request)) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/ads";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isPublicAdsApi(pathname)) return NextResponse.next();

  if (hasSession(request)) return NextResponse.next();

  if (adsApi) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/ads/enter";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/", "/ads", "/ads/:path*", "/api/ads", "/api/ads/:path*"],
};
