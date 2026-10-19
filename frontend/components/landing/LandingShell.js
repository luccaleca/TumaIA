"use client";

import { ThemeProvider, useTheme } from "../../app/components/ThemeProvider";

function LandingFrame({ children }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div
      className={`landing-page min-h-screen overflow-x-hidden bg-[var(--paper)] text-[var(--text)] transition-colors duration-300 ${
        isDark ? "dark" : ""
      }`}
    >
      {children}
    </div>
  );
}

export default function LandingShell({ children }) {
  return (
    <ThemeProvider>
      <LandingFrame>{children}</LandingFrame>
    </ThemeProvider>
  );
}
