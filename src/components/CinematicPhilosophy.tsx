"use client";

import { useRef, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  useReducedMotion,
} from "framer-motion";

const stages = [
  { num: "01", word: "SIMPLE", label: "01 — SIMPLE" },
  { num: "02", word: "FAST", label: "02 — FAST" },
  { num: "03", word: "USEFUL", label: "03 — USEFUL" },
  { num: "04", word: "CRAFTED", label: "04 — CRAFTED" },
];

export default function CinematicPhilosophy() {
  const containerRef = useRef<HTMLElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const [activeStage, setActiveStage] = useState(0);

  // Track scroll progress through the entire pinned container [0, 1]
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Track active stage index for counter and accessibility
  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (latest < 0.25) {
      setActiveStage(0);
    } else if (latest < 0.5) {
      setActiveStage(1);
    } else if (latest < 0.75) {
      setActiveStage(2);
    } else {
      setActiveStage(3);
    }
  });

  // Bottom lime horizontal progress line: 0% -> 100%
  const progressWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  // --- STAGE 0: SIMPLE. (0.00 -> 0.25) ---
  const opacity0 = useTransform(
    scrollYProgress,
    [0, 0.02, 0.19, 0.25],
    [1, 1, 1, 0]
  );
  const scale0 = useTransform(
    scrollYProgress,
    [0, 0.02, 0.19, 0.25],
    [1, 1, 1, 1.05]
  );
  const y0 = useTransform(
    scrollYProgress,
    [0, 0.02, 0.19, 0.25],
    [0, 0, 0, -28]
  );

  // --- STAGE 1: FAST. (0.25 -> 0.50) ---
  const opacity1 = useTransform(
    scrollYProgress,
    [0.22, 0.27, 0.44, 0.50],
    [0, 1, 1, 0]
  );
  const scale1 = useTransform(
    scrollYProgress,
    [0.22, 0.27, 0.44, 0.50],
    [0.95, 1, 1, 1.05]
  );
  const y1 = useTransform(
    scrollYProgress,
    [0.22, 0.27, 0.44, 0.50],
    [28, 0, 0, -28]
  );

  // --- STAGE 2: USEFUL. (0.50 -> 0.75) ---
  const opacity2 = useTransform(
    scrollYProgress,
    [0.47, 0.52, 0.69, 0.75],
    [0, 1, 1, 0]
  );
  const scale2 = useTransform(
    scrollYProgress,
    [0.47, 0.52, 0.69, 0.75],
    [0.95, 1, 1, 1.05]
  );
  const y2 = useTransform(
    scrollYProgress,
    [0.47, 0.52, 0.69, 0.75],
    [28, 0, 0, -28]
  );

  // --- STAGE 3: CRAFTED. (0.75 -> 1.00) ---
  const opacity3 = useTransform(
    scrollYProgress,
    [0.72, 0.77, 0.95, 1.00],
    [0, 1, 1, 0.2]
  );
  const scale3 = useTransform(
    scrollYProgress,
    [0.72, 0.77, 0.95, 1.00],
    [0.95, 1, 1, 1.02]
  );
  const y3 = useTransform(
    scrollYProgress,
    [0.72, 0.77, 0.95, 1.00],
    [28, 0, 0, -14]
  );

  const opacities = [opacity0, opacity1, opacity2, opacity3];
  const scales = [scale0, scale1, scale2, scale3];
  const yOffsets = [y0, y1, y2, y3];

  return (
    <section
      id="philosophy"
      ref={containerRef}
      className="relative w-full h-[400vh] bg-black text-[#F5F5F0]"
      aria-label="Philosophy"
    >
      {/* Sticky Fullscreen Cinematic Viewport Container */}
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-black flex flex-col justify-between items-center px-4 sm:px-8 py-8 sm:py-12 z-20">
        
        {/* Subtle Top Kicker / Header */}
        <div className="w-full max-w-7xl flex items-center justify-between font-mono text-[11px] sm:text-xs text-white/35 tracking-[0.25em] uppercase select-none">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#E8FF70] animate-pulse" aria-hidden="true" />
            <span className="text-[#E8FF70]/90 font-semibold">CORE ARCHITECTURE</span>
          </div>
          <span className="hidden sm:inline text-white/20 tracking-widest font-medium">
            CINEMATIC TYPOGRAPHY
          </span>
        </div>

        {/* Centered Massive Typography Stage */}
        <div className="relative w-full max-w-6xl flex-1 flex items-center justify-center">
          {stages.map((stage, idx) => (
            <motion.div
              key={stage.word}
              style={{
                opacity: opacities[idx],
                scale: shouldReduceMotion ? 1 : scales[idx],
                y: shouldReduceMotion ? 0 : yOffsets[idx],
              }}
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none text-center px-2"
            >
              {/* Technical Sequence Label (01 — SIMPLE) */}
              <span className="font-mono text-xs sm:text-sm md:text-base font-semibold tracking-[0.28em] uppercase text-[#E8FF70] mb-3 sm:mb-5 block">
                {stage.label}
              </span>

              {/* Dominant Centered Word with Lime Full Stop */}
              <h2 className="text-[14vw] sm:text-[11vw] lg:text-[10rem] xl:text-[11.5rem] font-black tracking-[-0.04em] text-[#F5F5F0] leading-none whitespace-nowrap">
                {stage.word}
                <span className="text-[#E8FF70]">.</span>
              </h2>
            </motion.div>
          ))}
        </div>

        {/* Subtle Bottom Bar */}
        <div className="w-full max-w-7xl flex items-center justify-between font-mono text-xs text-white/40 tracking-widest pb-3 sm:pb-4 select-none pr-16 sm:pr-24 lg:pr-32">
          <span className="text-[#E8FF70]/70 font-medium tracking-[0.2em] text-[10px] sm:text-xs">
            SCROLL TO ADVANCE
          </span>
          <span className="font-semibold text-[#E8FF70] tracking-[0.2em] text-xs">
            0{activeStage + 1} <span className="text-white/25 font-normal">/</span> 04
          </span>
        </div>

        {/* Bottom Pinned Horizontal Progress Line */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.08] z-30"
          role="progressbar"
          aria-valuenow={Math.round((activeStage + 1) * 25)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Philosophy Scroll Progress"
        >
          <motion.div
            style={{ width: progressWidth }}
            className="h-full bg-[#E8FF70] shadow-[0_0_12px_rgba(232,255,112,0.6)] will-change-transform"
          />
        </div>

      </div>
    </section>
  );
}
