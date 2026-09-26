import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname !== "/") return NextResponse.next();
  const host = (request.headers.get("host") || "").split(":")[0];
  const url = request.nextUrl.clone();
  url.pathname = host.startsWith("ads.") ? "/ads" : "/legacy-home.html";
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/"],
};
