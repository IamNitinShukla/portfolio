"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface IntroProps {
  onComplete: () => void;
}

// Authentic Apple "hello" cursive vector paths (extracted from Apple typography geometry)
const PATH_STROKE_0 =
  "M 60 701.23 C 171.01 639.52, 272.17 560.16, 386.94 425.08 C 465.06 332.88, 507.06 227.59, 509.06 154.97 C 510.06 100.97, 483.73 60, 435.06 60 C 381.06 60, 347.06 100.97, 326.06 195 C 303.06 298.34, 286.06 416.92, 243.06 797.16";

const PATH_STROKE_1 =
  "M 247.27 760 C 269.29 566.48, 353.06 425.16, 460.06 425.16 C 524.06 425.16, 564.73 476.16, 553.19 549.16 C 546.68 592.16, 539.15 636.16, 530.37 687.16 C 520.13 751.16, 549.39 801.16, 638.02 801.16 C 767.28 801.16, 908.3 729.33, 980.47 618.07 C 1005.06 580.16, 1015.06 546.16, 1016.06 513.16 C 1017.06 453.16, 983.06 408.16, 923.06 408.16 C 847.06 408.16, 789.06 494.16, 789.06 604.16 C 789.06 722.16, 853.06 805.16, 988.98 805.16 C 1173.78 805.16, 1378.48 583.31, 1472.54 335.74 C 1499.1 265.83, 1509.06 200.93, 1509.06 155.57 C 1509.06 101.78, 1492.06 60.49, 1444.06 60.49 C 1397.06 60.49, 1366.06 96.98, 1338.06 154.61 C 1305.25 221.44, 1280.99 317.83, 1271.06 426.8 C 1246.06 700.22, 1302.06 801.16, 1435.21 801.16 C 1596.67 801.16, 1776.18 576.23, 1867.83 334.97 C 1894.1 265.83, 1904.06 200.93, 1904.06 155.57 C 1904.06 101.78, 1887.06 60.49, 1839.06 60.49 C 1792.06 60.49, 1761.06 96.98, 1733.06 154.61 C 1700.25 221.44, 1675.99 317.83, 1666.06 426.8 C 1641.06 700.22, 1697.06 801.16, 1815.97 801.16 C 1934.68 801.16, 1999.17 697.68, 2037.84 587.79 C 2076.06 479.16, 2123.06 412.16, 2221.06 412.16 C 2302.06 412.16, 2366.06 472.16, 2366.06 585.16 C 2366.06 710.16, 2284.96 804.16, 2182.48 805.16 C 2092.29 806.16, 2033.06 733.16, 2039.06 623.16 C 2046.06 501.16, 2120.06 412.16, 2217.06 412.16 C 2273.06 412.16, 2320.1 437.05, 2357.06 464.16 C 2457.27 537.27, 2534.49 492.09, 2564.06 419.8";

export default function Intro({ onComplete }: IntroProps) {
  const [isFinishing, setIsFinishing] = useState(false);

  const path0Ref = useRef<SVGPathElement | null>(null);
  const path1Ref = useRef<SVGPathElement | null>(null);
  const stop1Ref = useRef<SVGStopElement | null>(null);
  const stop2Ref = useRef<SVGStopElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      onComplete();
      return;
    }

    // Lock body scroll during intro
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    let animationFrameId: number;
    let isCancelled = false;

    const handleFinish = () => {
      if (isCancelled) return;
      isCancelled = true;
      cancelAnimationFrame(animationFrameId);
      setIsFinishing(true);
      document.body.style.overflow = originalOverflow;
      setTimeout(() => {
        onComplete();
      }, 200);
    };

    // Keyboard shortcut to skip intro
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.code === "Space") {
        e.preventDefault();
        handleFinish();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    // Initialize SVG path lengths
    const p0 = path0Ref.current;
    const p1 = path1Ref.current;
    const stop1 = stop1Ref.current;
    const stop2 = stop2Ref.current;
    const container = containerRef.current;

    let len0 = 1665;
    let len1 = 8135;

    if (p0 && p1) {
      len0 = p0.getTotalLength();
      len1 = p1.getTotalLength();
      p0.style.strokeDasharray = `${len0} ${len0}`;
      p0.style.strokeDashoffset = `${len0}`;
      p1.style.strokeDasharray = `${len1} ${len1}`;
      p1.style.strokeDashoffset = `${len1}`;
    }

    let startTime: number | null = null;

    const tick = (now: number) => {
      if (isCancelled) return;
      if (startTime === null) startTime = now;
      const elapsed = now - startTime;

      // Phase 1: Progressive Natural Handwriting (0 - 1800ms)
      // Stroke 0: 0 - 320ms (h entry loop & stem)
      // Stroke 1: 320 - 1800ms (h arch, e, l, l, o, flourish tail)
      if (p0 && p1) {
        if (elapsed <= 320) {
          const p = Math.min(1, Math.max(0, elapsed / 320));
          const ease = 1 - Math.pow(1 - p, 1.3);
          p0.style.strokeDashoffset = `${len0 * (1 - ease)}`;
          p1.style.strokeDashoffset = `${len1}`;
        } else if (elapsed <= 1800) {
          p0.style.strokeDashoffset = "0";
          const p = Math.min(1, Math.max(0, (elapsed - 320) / (1800 - 320)));
          const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
          p1.style.strokeDashoffset = `${len1 * (1 - ease)}`;
        } else {
          p0.style.strokeDashoffset = "0";
          p1.style.strokeDashoffset = "0";
        }
      }

      // Phase 2: Completed Hold (1800 - 2200ms)
      // Path fully visible, mask inactive

      // Phase 3: Progressive Erasing from Left to Right (2200 - 2800ms)
      // Soft feathered gradient mask moves from left (h) to right (tail flourish vanishing last)
      if (stop1 && stop2) {
        if (elapsed < 2200) {
          stop1.setAttribute("offset", "0%");
          stop2.setAttribute("offset", "0%");
        } else if (elapsed <= 2800) {
          const eraseP = (elapsed - 2200) / 600; // 0 to 1
          const start = -8 + eraseP * (98 - (-8));
          const end = start + 10;
          stop1.setAttribute("offset", `${Math.max(0, Math.min(100, start))}%`);
          stop2.setAttribute("offset", `${Math.max(0, Math.min(100, end))}%`);
        } else {
          stop1.setAttribute("offset", "100%");
          stop2.setAttribute("offset", "100%");
        }
      }

      // Phase 4: Smooth Overlay Opacity Fade (2800 - 3000ms)
      if (container) {
        if (elapsed <= 2800) {
          container.style.opacity = "1";
        } else if (elapsed <= 3000) {
          const fadeProgress = (elapsed - 2800) / 200;
          container.style.opacity = `${Math.max(0, 1 - fadeProgress)}`;
        } else {
          container.style.opacity = "0";
        }
      }

      // End of intro sequence at exactly 3000ms
      if (elapsed >= 3000) {
        handleFinish();
      } else {
        animationFrameId = requestAnimationFrame(tick);
      }
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      isCancelled = true;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {!isFinishing && (
        <motion.div
          ref={containerRef}
          key="apple-hello-intro-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black overflow-hidden select-none cursor-default"
          style={{ backgroundColor: "#000000" }}
        >
          {/* Authentic Apple "hello" SVG handwriting */}
          <div className="relative w-full flex items-center justify-center px-6 sm:px-12 pointer-events-none">
            <svg
              viewBox="0 0 2625 867"
              className="w-[85vw] max-w-[960px] h-auto overflow-visible"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="hello"
            >
              <defs>
                {/* Horizontal feathered mask for smooth left-to-right stroke erase */}
                <linearGradient id="apple-hello-erase-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop ref={stop1Ref} offset="0%" stopColor="#ffffff" stopOpacity="0" />
                  <stop ref={stop2Ref} offset="0%" stopColor="#ffffff" stopOpacity="1" />
                </linearGradient>
                <mask id="apple-hello-erase-mask">
                  <rect x="0" y="0" width="2625" height="867" fill="url(#apple-hello-erase-grad)" />
                </mask>
              </defs>

              <g mask="url(#apple-hello-erase-mask)">
                <path
                  ref={path0Ref}
                  d={PATH_STROKE_0}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="26"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="antialiased"
                />
                <path
                  ref={path1Ref}
                  d={PATH_STROKE_1}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="26"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="antialiased"
                />
              </g>
            </svg>
          </div>

          {/* Minimal, elegant, non-intrusive skip button */}
          <button
            onClick={() => {
              setIsFinishing(true);
              document.body.style.overflow = "auto";
              setTimeout(onComplete, 150);
            }}
            aria-label="Skip website intro (or press Escape)"
            className="absolute bottom-8 right-8 z-20 text-[11px] font-mono tracking-widest uppercase text-white/30 hover:text-white/70 transition-colors focus:outline-none focus-visible:text-white"
          >
            Skip <span className="opacity-50 text-[10px] ml-1">[Esc]</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
