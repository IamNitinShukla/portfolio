"use client";

import { useReducedMotion } from "framer-motion";

interface Dot {
  x: string;
  y: string;
  color: string;
  shadow: string;
  size: string;
  animClass: string;
  duration: string;
  delay: string;
}

const SURFACE_DOTS: Dot[] = [
  // Top Header Area (Above Photo Container)
  { x: "12%", y: "4.5%", color: "bg-sky-400", shadow: "shadow-[0_0_6px_rgba(56,189,248,0.7)]", size: "w-1 h-1", animClass: "dot-drift-1", duration: "7.2s", delay: "0s" },
  { x: "28%", y: "7%", color: "bg-violet-400", shadow: "shadow-[0_0_6px_rgba(168,85,247,0.7)]", size: "w-1 h-1", animClass: "dot-drift-2", duration: "8.4s", delay: "1.4s" },
  { x: "72%", y: "6.5%", color: "bg-rose-400", shadow: "shadow-[0_0_7px_rgba(244,63,94,0.7)]", size: "w-1.5 h-1.5", animClass: "dot-drift-3", duration: "6.8s", delay: "2.1s" },
  { x: "89%", y: "4%", color: "bg-emerald-400", shadow: "shadow-[0_0_6px_rgba(34,197,94,0.7)]", size: "w-1 h-1", animClass: "dot-drift-4", duration: "7.8s", delay: "0.7s" },

  // Left Outer Margin (Gutter strictly outside the photo container)
  { x: "2.6%", y: "22%", color: "bg-sky-400", shadow: "shadow-[0_0_6px_rgba(56,189,248,0.7)]", size: "w-1 h-1", animClass: "dot-drift-2", duration: "8.0s", delay: "1.8s" },
  { x: "2.2%", y: "42%", color: "bg-violet-400", shadow: "shadow-[0_0_7px_rgba(168,85,247,0.7)]", size: "w-1.5 h-1.5", animClass: "dot-drift-4", duration: "6.6s", delay: "2.9s" },
  { x: "2.8%", y: "64%", color: "bg-emerald-400", shadow: "shadow-[0_0_6px_rgba(34,197,94,0.7)]", size: "w-1 h-1", animClass: "dot-drift-1", duration: "7.4s", delay: "0.5s" },

  // Right Outer Margin (Gutter strictly outside the photo container)
  { x: "96.5%", y: "24%", color: "bg-rose-400", shadow: "shadow-[0_0_6px_rgba(244,63,94,0.7)]", size: "w-1 h-1", animClass: "dot-drift-3", duration: "7.6s", delay: "2.3s" },
  { x: "97.2%", y: "46%", color: "bg-sky-400", shadow: "shadow-[0_0_7px_rgba(56,189,248,0.7)]", size: "w-1.5 h-1.5", animClass: "dot-drift-1", duration: "8.2s", delay: "1.1s" },
  { x: "96.2%", y: "66%", color: "bg-violet-400", shadow: "shadow-[0_0_6px_rgba(168,85,247,0.7)]", size: "w-1 h-1", animClass: "dot-drift-2", duration: "6.9s", delay: "1.7s" },

  // Bottom Footer Area (Below Photo Container)
  { x: "7%", y: "86%", color: "bg-emerald-400", shadow: "shadow-[0_0_6px_rgba(34,197,94,0.7)]", size: "w-1 h-1", animClass: "dot-drift-4", duration: "8.6s", delay: "1.3s" },
  { x: "32%", y: "94.5%", color: "bg-sky-400", shadow: "shadow-[0_0_6px_rgba(56,189,248,0.7)]", size: "w-1 h-1", animClass: "dot-drift-1", duration: "7.0s", delay: "2.5s" },
  { x: "52%", y: "96%", color: "bg-violet-400", shadow: "shadow-[0_0_7px_rgba(168,85,247,0.7)]", size: "w-1.5 h-1.5", animClass: "dot-drift-3", duration: "8.1s", delay: "0.9s" },
  { x: "74%", y: "93.5%", color: "bg-rose-400", shadow: "shadow-[0_0_6px_rgba(244,63,94,0.7)]", size: "w-1 h-1", animClass: "dot-drift-2", duration: "7.5s", delay: "2.0s" },
  { x: "92%", y: "88%", color: "bg-sky-400", shadow: "shadow-[0_0_6px_rgba(56,189,248,0.7)]", size: "w-1 h-1", animClass: "dot-drift-4", duration: "7.9s", delay: "0.4s" },
];

interface CardSurfaceRgbDotsProps {
  isUpiMode?: boolean;
  isTransforming?: boolean;
}

export default function CardSurfaceRgbDots({
  isUpiMode = false,
  isTransforming = false,
}: CardSurfaceRgbDotsProps) {
  const prefersReduced = useReducedMotion();

  return (
    <div
      className={`pointer-events-none absolute inset-0 rounded-[28px] sm:rounded-[32px] overflow-hidden z-0 transition-opacity duration-300 ${
        isTransforming ? "opacity-0" : isUpiMode ? "opacity-35" : "opacity-100"
      }`}
      aria-hidden="true"
    >
      {SURFACE_DOTS.map((dot, idx) => (
        <span
          key={idx}
          className={`absolute rounded-full opacity-40 dark:opacity-50 ${dot.color} ${dot.shadow} ${dot.size}`}
          style={{
            left: dot.x,
            top: dot.y,
            animation: prefersReduced
              ? "none"
              : `${dot.animClass} ${dot.duration} ease-in-out infinite`,
            animationDelay: dot.delay,
            willChange: "transform, opacity",
          }}
        />
      ))}

      <style jsx>{`
        @keyframes dot-drift-1 {
          0%, 100% {
            transform: translate3d(0, 0, 0) scale(0.95);
            opacity: 0.35;
          }
          30% {
            transform: translate3d(3px, -3.5px, 0) scale(1.15);
            opacity: 0.65;
          }
          65% {
            transform: translate3d(-2px, -4.5px, 0) scale(0.9);
            opacity: 0.4;
          }
          85% {
            transform: translate3d(-3.5px, 1.5px, 0) scale(1.1);
            opacity: 0.55;
          }
        }

        @keyframes dot-drift-2 {
          0%, 100% {
            transform: translate3d(0, 0, 0) scale(1.0);
            opacity: 0.3;
          }
          25% {
            transform: translate3d(-3px, 3px, 0) scale(1.2);
            opacity: 0.65;
          }
          55% {
            transform: translate3d(2.5px, -3px, 0) scale(0.95);
            opacity: 0.45;
          }
          80% {
            transform: translate3d(3.5px, 2px, 0) scale(1.1);
            opacity: 0.6;
          }
        }

        @keyframes dot-drift-3 {
          0%, 100% {
            transform: translate3d(0, 0, 0) scale(1.05);
            opacity: 0.4;
          }
          35% {
            transform: translate3d(3.5px, 2.5px, 0) scale(0.9);
            opacity: 0.3;
          }
          70% {
            transform: translate3d(-2.5px, -3.5px, 0) scale(1.2);
            opacity: 0.7;
          }
        }

        @keyframes dot-drift-4 {
          0%, 100% {
            transform: translate3d(0, 0, 0) scale(0.95);
            opacity: 0.3;
          }
          40% {
            transform: translate3d(-2.5px, -3.5px, 0) scale(1.2);
            opacity: 0.65;
          }
          75% {
            transform: translate3d(3px, 3px, 0) scale(1.0);
            opacity: 0.45;
          }
        }
      `}</style>
    </div>
  );
}
