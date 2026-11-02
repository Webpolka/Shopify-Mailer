import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

/**
 * Theme toggle — switches between light/dark by toggling
 * `.dark` class on <html>. Persists choice in localStorage.
 *
 * IMPORTANT: Render a static placeholder until mounted to avoid
 * SSR hydration mismatch (server doesn't know the theme).
 */
export function ThemeToggle({ className }: { className?: string }) {
  // mount gate — avoids hydration mismatch
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");

  // Read from localStorage on mount + apply
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("theme");
    const isDark =
      stored === "dark" ||
      (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setTheme(isDark ? "dark" : "light");
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, []);

  // Apply theme to <html> + persist whenever theme changes
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme, mounted]);

  const toggle = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // Render a placeholder with the same dimensions until mounted.
  // This prevents SSR/client mismatch on the icon SVG.
  if (!mounted) {
    return (
      <div
        className={cn(
          "inline-flex items-center justify-center h-9 w-9 rounded-md border",
          "bg-background border-border",
          className
        )}
        aria-hidden
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      }
      className={cn(
        "inline-flex items-center justify-center h-9 w-9 rounded-md border transition-colors",
        "bg-background text-foreground border-border hover:bg-accent",
        className
      )}
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}