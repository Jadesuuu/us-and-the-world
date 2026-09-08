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
    // Run on pages only. Skipped:
    //   - Next internals and static asset extensions
    //   - /api/* — every route handler calls supabase.auth.getUser()
    //     itself, so the middleware's getUser() was a second network
    //     round-trip per request (two per place-photo thumbnail)
    //   - sw.js / manifest.json — public by nature, no session needed
    "/((?!api/|_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
