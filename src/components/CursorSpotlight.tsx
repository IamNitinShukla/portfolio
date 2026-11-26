"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@/context/ThemeContext";

export default function CursorSpotlight() {
  const spotlightRef = useRef<HTMLDivElement | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    // Check for fine pointer (disables on mobile and touch devices)
    const isFinePointer = window.matchMedia("(pointer: fine)").matches;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!isFinePointer || prefersReducedMotion) {
      if (spotlightRef.current) {
        spotlightRef.current.style.display = "none";
      }
      return;
    }

    const el = spotlightRef.current;
    if (!el) return;
    el.style.display = "block";

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;
    let isVisible = false;
    let rafId: number;

    const handlePointerMove = (e: PointerEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!isVisible) {
        isVisible = true;
        el.style.opacity = "1";
      }
    };

    const handleMouseLeave = () => {
      isVisible = false;
      el.style.opacity = "0";
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("mouseleave", handleMouseLeave);

    const isDark = theme === "dark";
    // Dark mode: soft translucent Lime #E8FF70 glow (strictly preserved)
    // Light mode: rich, diffused Digital Violet #6657D9 glow (enhanced visibility & saturation)
    const gradient = isDark
      ? (x: number, y: number) =>
          `radial-gradient(650px circle at ${x}px ${y}px, rgba(232, 255, 112, 0.055) 0%, rgba(232, 255, 112, 0.02) 40%, transparent 70%)`
      : (x: number, y: number) =>
          `radial-gradient(650px circle at ${x}px ${y}px, rgba(102, 87, 217, 0.13) 0%, rgba(102, 87, 217, 0.055) 38%, transparent 70%)`;

    const render = () => {
      // Smooth interpolation (lerp factor 0.14 for organic fluid response)
      currentX += (targetX - currentX) * 0.14;
      currentY += (targetY - currentY) * 0.14;

      el.style.background = gradient(Math.round(currentX), Math.round(currentY));
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafId);
      } else {
        rafId = requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [theme]);

  return (
    <div
      ref={spotlightRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-700 opacity-0"
    />
  );
}
