"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  resolveTheme,
  type ThemeId,
  type ThemePreference,
} from "@/lib/themes";

interface ThemeContextValue {
  theme: ThemePreference;
  resolvedTheme: ThemeId;
  setTheme: (t: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "jf-theme";
const VALID = ["dream", "night", "galaxy", "paper", "auto"] as const;
type Valid = (typeof VALID)[number];
function isValid(s: string | null): s is Valid {
  return s != null && (VALID as readonly string[]).includes(s);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // SSR-safe initial state. The inline FOUC script in <head> has already
  // applied data-theme to <html>, so we don't render a flash. We just need
  // to mirror the same source-of-truth into React state on mount.
  const [theme, setThemeState] = useState<ThemePreference>("auto");
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isValid(stored)) {
      setThemeState(stored);
    }

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const resolvedTheme = useMemo(
    () => resolveTheme(theme, systemDark),
    [theme, systemDark],
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((t: ThemePreference) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* private mode / storage disabled */
    }
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
}
