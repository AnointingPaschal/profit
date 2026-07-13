"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface ThemeCtx { dark: boolean; toggle: () => void }
const Ctx = createContext<ThemeCtx>({ dark: false, toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("profit.theme");
    if (stored === "dark") {
      setDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggle = () => {
    setDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("profit.theme", next ? "dark" : "light");
      return next;
    });
  };

  return <Ctx.Provider value={{ dark, toggle }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
