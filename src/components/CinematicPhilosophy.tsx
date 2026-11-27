"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  useReducedMotion,
} from "framer-motion";

const stages = [
  { word: "SIMPLE", subheading: "Clarity over complexity." },
  { word: "FAST", subheading: "Respect every millisecond." },
  { word: "USEFUL", subheading: "Solve what actually matters." },
  { word: "CRAFTED", subheading: "Details make the difference." },
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

  // Track active stage index for accessibility
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
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-black flex items-center justify-center px-4 sm:px-8 z-20">
        
        {/* Stationary Atmospheric Robotic Background */}
        <div
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden flex items-center justify-center select-none"
          aria-hidden="true"
        >
          <div className="relative w-full max-w-[1280px] h-[70vh] sm:h-[80vh] max-h-[720px] opacity-[0.16] sm:opacity-[0.20] blur-[16px] sm:blur-[22px] contrast-75 brightness-[0.45] scale-105 sm:scale-110">
            <Image
              src="/images/creative-hands.svg"
              alt=""
              fill
              priority
              unoptimized
              className="object-contain object-center"
            />
          </div>

          {/* Dark Overlay for seamless blending into pure black */}
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,#000000_85%)]" />
        </div>

        {/* Centered Massive Typography Stage (Synchronized Crossfade) */}
        <div className="relative z-10 w-full max-w-6xl flex items-center justify-center h-full">
          {stages.map((stage, idx) => (
            <motion.div
              key={stage.word}
              style={{
                opacity: opacities[idx],
                scale: shouldReduceMotion ? 1 : scales[idx],
                y: shouldReduceMotion ? 0 : yOffsets[idx],
              }}
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none text-center px-4"
            >
              {/* Dominant Centered Word with Lime Full Stop */}
              <h2 className="text-[14vw] sm:text-[11vw] lg:text-[10rem] xl:text-[11.5rem] font-black tracking-[-0.04em] text-[#F5F5F0] leading-none whitespace-nowrap">
                {stage.word}
                <span className="text-[#E8FF70]">.</span>
              </h2>

              {/* Short Understated Supporting Heading */}
              <p className="mt-4 sm:mt-6 md:mt-8 text-base sm:text-xl md:text-2xl lg:text-[1.65rem] font-medium tracking-[-0.015em] text-[#A4A49C] text-center select-none max-w-xl mx-auto px-4">
                {stage.subheading}
              </p>
            </motion.div>
          ))}
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
