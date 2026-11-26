"use client";

import { useTheme } from "@/context/ThemeContext";
import { Sun, Moon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ThemeToggle() {
  const { theme, toggleTheme, mounted } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
      className="relative p-2 rounded-full text-primary-muted hover:text-primary transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9"
    >
      <AnimatePresence mode="wait" initial={false}>
        {!mounted ? (
          // Neutral placeholder before mount to avoid hydration mismatch
          <span className="w-4 h-4 opacity-0" />
        ) : theme === "dark" ? (
          <motion.div
            key="moon"
            initial={{ rotate: -90, scale: 0.6, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 90, scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-center"
          >
            <Moon className="w-4 h-4 text-accent" />
          </motion.div>
        ) : (
          <motion.div
            key="sun"
            initial={{ rotate: 90, scale: 0.6, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: -90, scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-center"
          >
            <Sun className="w-4 h-4 text-accent" />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}
