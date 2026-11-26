"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { portfolioData } from "@/data/portfolioData";
import { useTheme } from "@/context/ThemeContext";
import ParticleBackground from "@/components/ParticleBackground";
import { ArrowRight, Sparkles } from "lucide-react";

interface IntroProps {
  onComplete: () => void;
}

export default function Intro({ onComplete }: IntroProps) {
  const { intro } = portfolioData;
  const { theme } = useTheme();

  const [text1, setText1] = useState("");
  const [text2, setText2] = useState("");
  const [showDescriptor, setShowDescriptor] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

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

    // Escape, Enter, or Space key immediately triggers polished exit
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.code === "Space") {
        e.preventDefault();
        handleFinish();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    let isMounted = true;
    const timeouts: NodeJS.Timeout[] = [];

    // Stage A: Typewriter Sequence
    const line1 = intro.greeting;
    const line2 = intro.taglineLead + intro.taglineAccent;

    // Type line 1 character by character
    let charIdx1 = 0;
    const interval1 = setInterval(() => {
      if (!isMounted) return clearInterval(interval1);
      charIdx1++;
      setText1(line1.slice(0, charIdx1));
      if (charIdx1 >= line1.length) {
        clearInterval(interval1);

        // Pause briefly, then type line 2 character by character
        timeouts.push(
          setTimeout(() => {
            if (!isMounted) return;
            let charIdx2 = 0;
            const interval2 = setInterval(() => {
              if (!isMounted) return clearInterval(interval2);
              charIdx2++;
              setText2(line2.slice(0, charIdx2));
              if (charIdx2 >= line2.length) {
                clearInterval(interval2);
                if (isMounted) {
                  setShowDescriptor(true);
                  // Cinematic pause before transitioning into the homepage (~2.6s total sequence)
                  timeouts.push(
                    setTimeout(() => {
                      if (isMounted) handleFinish();
                    }, 800)
                  );
                }
              }
            }, 30);
          }, 100)
        );
      }
    }, 38);

    const handleFinish = () => {
      if (!isMounted) return;
      setIsFinishing(true);
      document.body.style.overflow = originalOverflow;
      setTimeout(() => {
        onComplete();
      }, 550);
    };

    return () => {
      isMounted = false;
      document.body.style.overflow = originalOverflow;
      clearInterval(interval1);
      timeouts.forEach(clearTimeout);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [intro, onComplete]);

  // Compute accent highlight for line 2
  const leadLength = intro.taglineLead.length;
  const line2Lead = text2.slice(0, leadLength);
  const line2Accent = text2.length > leadLength ? text2.slice(leadLength) : "";

  return (
    <AnimatePresence>
      {!isFinishing && (
        <motion.div
          key="cinematic-intro-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.015 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background text-primary overflow-hidden select-none"
        >
          {/* Animated RGB Particle Background dedicated to intro overlay */}
          <div className="absolute inset-0 pointer-events-none z-0">
            <ParticleBackground className="absolute inset-0" />
          </div>

          {/* Central Radial Ambient Lighting */}
          <div className="pointer-events-none absolute w-[650px] h-[400px] rounded-full bg-accent/[0.08] blur-[150px] -translate-y-6 z-[1]" />

          {/* Centered Composition */}
          <div className="relative z-10 max-w-3xl mx-auto px-6 text-center flex flex-col items-center">
            
            {/* Top Micro Eyebrow */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface border border-border mb-6 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-accent animate-pulse" />
              <span className="font-mono text-[10px] font-bold tracking-[0.2em] uppercase text-primary-muted">
                INITIALIZING PORTFOLIO EXPERIENCE
              </span>
            </motion.div>

            {/* Line 1: HELLO, I'M NITIN. */}
            <div className="min-h-[2.5rem] sm:min-h-[3.5rem] flex items-center justify-center mb-3">
              <h2 className="font-mono text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-primary">
                {text1}
                {text1.length < intro.greeting.length && (
                  <span className="inline-block w-2.5 h-6 sm:h-8 ml-1.5 bg-accent align-middle animate-pulse" />
                )}
              </h2>
            </div>

            {/* Line 2: I BUILD INTELLIGENT DIGITAL EXPERIENCES. */}
            <div className="min-h-[3rem] sm:min-h-[4rem] flex items-center justify-center mb-8">
              <h1 className="text-xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-primary max-w-2xl leading-tight">
                <span>{line2Lead}</span>
                <span className="text-accent underline decoration-accent/40 decoration-2 underline-offset-4">
                  {line2Accent}
                </span>
                {text2.length >= leadLength && text2.length < intro.taglineLead.length + intro.taglineAccent.length && (
                  <span className="inline-block w-2 h-5 sm:h-7 ml-1 bg-accent align-middle animate-pulse" />
                )}
              </h1>
            </div>

            {/* Descriptor Pill: AI ENGINEER • FULL-STACK DEVELOPER */}
            <div className="min-h-[2rem]">
              <AnimatePresence>
                {showDescriptor && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-surface-secondary border border-border shadow-md"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-accent animate-ping" />
                    <span className="font-mono text-xs font-semibold tracking-widest text-primary-muted uppercase">
                      {intro.descriptor}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>

          {/* Accessible Skip Button at Bottom */}
          <div className="absolute bottom-8 z-20">
            <button
              onClick={() => {
                document.body.style.overflow = "auto";
                onComplete();
              }}
              aria-label="Skip website introduction (Press Escape)"
              className="group flex items-center gap-2 px-4 py-2 rounded-full bg-surface/90 hover:bg-surface border border-border hover:border-accent text-primary-muted hover:text-primary transition-all text-xs font-mono shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span>Skip Intro</span>
              <kbd className="px-1.5 py-0.5 rounded bg-surface-secondary border border-border text-[10px] text-primary-muted font-sans group-hover:text-primary">
                Esc
              </kbd>
              <ArrowRight className="w-3 h-3 text-accent group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
