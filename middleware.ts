import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { IS_DEMO } from "@/lib/demo";

export async function middleware(request: NextRequest) {
  if (IS_DEMO) {
    // No auth in the read-only demo. Anyone landing on /login or the
    // magic-link callback is sent to the map.
    const { pathname } = request.nextUrl;
    if (pathname === "/login" || pathname.startsWith("/auth/")) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Run on all paths except Next internals and static asset extensions.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
