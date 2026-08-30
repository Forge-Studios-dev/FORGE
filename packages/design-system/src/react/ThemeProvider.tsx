'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemeMode = 'dark' | 'light';

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyThemeClass(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(mode);
}

function readDomTheme(): ThemeMode {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.classList.contains('light') ? 'light' : 'dark';
}

export type ThemeProviderProps = {
  children: ReactNode;
  /** localStorage key — keep web (`forge-theme`) and admin (`forge-admin-theme`) distinct. */
  storageKey: string;
  /**
   * When no stored preference, use `prefers-color-scheme: light` → light.
   * Admin defaults off (always dark until chosen); web defaults on.
   */
  preferSystemLight?: boolean;
};

/**
 * Shared light/dark theme provider for FORGE web + admin.
 * Pair with a blocking FOUC script in layout that reads the same `storageKey`.
 */
export function ThemeProvider({
  children,
  storageKey,
  preferSystemLight = false,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(readDomTheme);

  useEffect(() => {
    let initial: ThemeMode = 'dark';
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw === 'light' || raw === 'dark') {
        initial = raw;
      } else if (
        preferSystemLight &&
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: light)').matches
      ) {
        initial = 'light';
      }
    } catch {
      /* ignore */
    }
    setThemeState(initial);
    applyThemeClass(initial);
  }, [storageKey, preferSystemLight]);

  const setTheme = useCallback(
    (mode: ThemeMode) => {
      setThemeState(mode);
      applyThemeClass(mode);
      try {
        localStorage.setItem(storageKey, mode);
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [setTheme, theme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
