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
        {/* Low-priority preload: warms the cache so switching to Galaxy
            doesn't flash a black screen before the starfield paints.
            Remove if it ever shows up as a regression on slow links. */}
        <link
          rel="preload"
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
