import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'dark' | 'light';

export const THEME_KEY = 'elite-erp-theme';

export const DEFAULT_THEME: ThemeMode = 'dark';

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
  }
  return DEFAULT_THEME;
}

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  root.setAttribute('data-theme', mode);
  root.style.colorScheme = mode;
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('theme-transition');
    applyTheme(theme);
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
    }
    const t = window.setTimeout(() => root.classList.remove('theme-transition'), 600);
    return () => {
      window.clearTimeout(t);
      root.classList.remove('theme-transition');
    };
  }, [theme]);

  const setTheme = useCallback((mode: ThemeMode) => setThemeState(mode), []);
  const toggleTheme = useCallback(() => setThemeState(prev => (prev === 'dark' ? 'light' : 'dark')), []);

  return { theme, setTheme, toggleTheme };
}
