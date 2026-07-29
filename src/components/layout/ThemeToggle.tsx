"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("myb-theme");
    const isDark = stored === "dark";
    setDark(isDark);
    if (isDark) document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("myb-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("myb-theme", "light");
    }
  }

  return (
    <button
      onClick={toggle}
      className={`flex items-center justify-center rounded-[var(--r-md)] transition-colors ${className}`}
      style={{
        color: "var(--fg-3)",
        backgroundColor: "transparent",
        border: "1px solid var(--border)",
        width: 36,
        height: 36,
        minHeight: "unset",
        minWidth: "unset",
      }}
      aria-label={dark ? "Passa alla modalità chiara" : "Passa alla modalità scura"}
    >
      {dark
        ? <Sun className="w-4 h-4" strokeWidth={1.8} />
        : <Moon className="w-4 h-4" strokeWidth={1.8} />
      }
    </button>
  );
}
