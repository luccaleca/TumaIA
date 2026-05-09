"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "tuma-theme";

const ThemeContext = createContext(null);

function normalizeStored(raw) {
  if (raw === "dark") return "dark";
  return "light";
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("light");

  useLayoutEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "system") {
        localStorage.setItem(STORAGE_KEY, "light");
      }
      setThemeState(normalizeStored(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const setTheme = useCallback((next) => {
    const t = next === "dark" ? "dark" : "light";
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme deve ser usado dentro de ThemeProvider");
  }
  return ctx;
}
