"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";

type Theme = "dark" | "light";

const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void }>({
  theme: "dark",
  toggleTheme: () => {},
});

function getThemeSnapshot(): Theme {
  return localStorage.getItem("ot-theme") === "light" ? "light" : "dark";
}

function getServerSnapshot(): Theme {
  return "dark";
}

function subscribeTheme(onStoreChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === "ot-theme" || e.key === null) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("ot-theme-change", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("ot-theme-change", onStoreChange);
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("ot-theme", next);
    window.dispatchEvent(new Event("ot-theme-change"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
