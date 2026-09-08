// Demo-mode switch.
//
// When NEXT_PUBLIC_DEMO_MODE=1 at build time the app runs as a read-only
// portfolio demo: every data hook returns the bundled snapshot in
// lib/demo-data.ts instead of querying Supabase, auth is bypassed, and
// every write path (search, add pin, log visit, delete, push) is hidden.
//
// The flag is inlined at build time, so the production deployment (which
// never sets it) tree-shakes the demo branches away.
export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

// Fake viewer id for demo mode. Deliberately matches no real created_by
// so isCreator-gated controls (delete pin, edit visit) never render.
export const DEMO_VIEWER_ID = "demo-viewer";

// Optional "back to portfolio" link shown in the demo banner.
export const DEMO_BACK_URL = process.env.NEXT_PUBLIC_DEMO_BACK_URL ?? null;
