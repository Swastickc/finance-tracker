import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

/** No-op unless APP_ACCESS_PASSWORD is configured — keeps zero-config local dev working. */
export async function proxy(request: NextRequest) {
  if (!process.env.APP_ACCESS_PASSWORD) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname === "/login") return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token)) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
