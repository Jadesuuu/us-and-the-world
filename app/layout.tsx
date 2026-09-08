import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Caveat } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { ThemeProvider } from "@/components/ThemeProvider";
import GalaxyBackdrop from "@/components/GalaxyBackdrop";
import PaperTexture from "@/components/PaperTexture";
import AtmosphericLayer from "@/components/AtmosphericLayer";
import DemoBanner from "@/components/DemoBanner";
import { IS_DEMO } from "@/lib/demo";
import { Toaster } from "sonner";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["400"],
  // Only used for handwritten visit notes inside drawers; fetch it when
  // first painted rather than ahead of the map.
  preload: false,
});

export const metadata: Metadata = {
  title: "JF & The World",
  description: "JF & The World",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "JF & The World",
    statusBarStyle: "black-translucent",
  },
  // Icons are auto-discovered from the file-system convention:
  //   app/icon.svg         → browser tab (any size, scales cleanly)
  //   app/apple-icon.png   → iOS home-screen
  //   public/icons/*.png   → PWA manifest (referenced by manifest.json)
};

export const viewport: Viewport = {
  // Browser chrome tint matches the first-paint theme: Galaxy in the demo.
  themeColor: IS_DEMO ? "#050b1f" : "#f7f1e8",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

// Keep in sync with DEFAULT_THEME in components/ThemeProvider.tsx.
const defaultTheme = IS_DEMO ? "galaxy" : "auto";

// Origin only (no path) for the preconnect hint. Undefined in demo builds.
const supabaseOrigin = (() => {
  try {
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return u ? new URL(u).origin : null;
  } catch {
    return null;
  }
})();

const fouc = `try {
  var t = localStorage.getItem('jf-theme') || '${defaultTheme}';
  if (t === 'auto') {
    t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'dream';
  }
  document.documentElement.setAttribute('data-theme', t);
} catch (e) {}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${inter.variable} ${caveat.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: fouc }} />
        {/* The map is the first thing on screen and every style, sprite,
            glyph and tile comes from api.mapbox.com. Opening the
            connection during HTML parse saves a DNS+TLS round trip before
            the first tile request. */}
        <link rel="preconnect" href="https://api.mapbox.com" />
        <link rel="dns-prefetch" href="https://events.mapbox.com" />
        {!IS_DEMO && supabaseOrigin && (
          <link rel="preconnect" href={supabaseOrigin} />
        )}
        {/* Low-priority preload: warms the cache so switching to Galaxy
            doesn't flash a black screen before the starfield paints.
            Remove if it ever shows up as a regression on slow links. */}
        <link
          // Only the demo opens in Galaxy. Production defaults to Dream or
          // Night, so a high-priority preload there just competes with the
          // map for bandwidth; prefetch warms the cache at idle instead.
          rel={IS_DEMO ? "preload" : "prefetch"}
          as="image"
          href="/textures/starfield.webp"
          type="image/webp"
        />
      </head>
      <body className="h-full flex flex-col">
        <ThemeProvider>
          <GalaxyBackdrop />
          <AtmosphericLayer />
          <PaperTexture />
          <Providers>
            {children}
            <DemoBanner />
            <Toaster
              position="bottom-center"
              toastOptions={{
                style: {
                  background: "var(--surface)",
                  color: "var(--ink)",
                  border: "1px solid var(--border)",
                  fontFamily: "var(--font-body)",
                  zIndex: 50,
                },
              }}
            />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
