'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

type Theme = 'dark' | 'light';

interface ThemeCtx {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
  showNightBanner: boolean;
  dismissNightBanner: () => void;
}

const Ctx = createContext<ThemeCtx>(null!);

function getStored(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return (localStorage.getItem('theme') as Theme) ?? 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }): ReactElement {
  const [theme, setThemeState] = useState<Theme>(getStored);
  const [showNightBanner, setShowNightBanner] = useState(false);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem('theme', t);
    document.documentElement.setAttribute('data-theme', t);
    // Also set cookie for SSR
    document.cookie = `theme=${t};path=/;max-age=31536000;SameSite=Lax`;
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const dismissNightBanner = useCallback(() => {
    setShowNightBanner(false);
    sessionStorage.setItem('night-banner-dismissed', '1');
  }, []);

  // Apply theme on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Check for 22:00 suggestion
  useEffect(() => {
    function checkTime() {
      const hour = new Date().getHours();
      const isDark = theme === 'dark';
      const dismissed = sessionStorage.getItem('night-banner-dismissed') === '1';
      if (hour >= 22 && !isDark && !dismissed) {
        setShowNightBanner(true);
      } else {
        setShowNightBanner(false);
      }
    }
    checkTime();
    const interval = setInterval(checkTime, 60_000);
    return () => clearInterval(interval);
  }, [theme]);

  const ctx = useMemo(
    () => ({ theme, setTheme, toggle, showNightBanner, dismissNightBanner }),
    [theme, setTheme, toggle, showNightBanner, dismissNightBanner],
  );

  return <Ctx value={ctx}>{children}</Ctx>;
}

export function useTheme() {
  return useContext(Ctx);
}
