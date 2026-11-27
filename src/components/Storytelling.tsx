"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { portfolioData } from "@/data/portfolioData";
import SpiderMascot from "@/components/SpiderMascot";

export default function Storytelling() {
  const shouldReduceMotion = useReducedMotion();
  const [activeRow, setActiveRow] = useState<number | null>(null);

  const { eyebrow, title, intro, principles } = portfolioData.philosophy;

  return (
    <section
      id="philosophy"
      className="relative py-14 sm:py-20 lg:py-24 border-b border-border bg-transparent transition-colors overflow-hidden"
    >
      {/* Background Accent Glow */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-accent/[0.04] blur-[160px] rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Kicker */}
        <div className="flex flex-col items-start mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface border border-border mb-4 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-primary-muted">
              {eyebrow}
            </span>
          </div>

          <h2 className="text-4xl sm:text-6xl font-extrabold tracking-[-0.035em] text-primary">
            {title}
          </h2>
        </div>

        {/* Central Creative Image Composition */}
        <div className="relative w-full aspect-[16/8.5] max-h-[480px] rounded-[28px] overflow-hidden border border-border mb-12 sm:mb-16 lg:mb-20 shadow-xl bg-surface-secondary group">
          <Image
            src="/images/creative-hands.svg"
            alt="AI and Human Engineering Synergy"
            fill
            loading="lazy"
            unoptimized
            className="object-cover object-center group-hover:scale-[1.02] transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
          
          {/* Subtle Spider Mascot on wire */}
          <div className="absolute top-4 right-8 animate-float-spider hidden sm:block">
            <SpiderMascot size={52} />
          </div>

          {/* Bottom Caption Pill */}
          <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between font-mono text-xs text-primary-muted">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
              <span className="text-primary font-semibold tracking-wider">CORE ARCHITECTURAL MANIFESTO</span>
            </span>
            <span className="hidden sm:inline text-accent tracking-widest font-semibold">DISCIPLINED SYSTEMS // HIGH CRAFT</span>
          </div>
        </div>

        {/* ===================================================================
            EDITORIAL ENGINEERING SECTION (EXPERIMENT 1)
            =================================================================== */}
        <div className="mt-4 sm:mt-6 lg:mt-8">
          
          {/* Editorial Introduction */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="mb-10 sm:mb-14 lg:mb-16 max-w-3xl"
          >
            {/* Section label */}
            <div className="flex items-center gap-2.5 mb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
              <span className="font-mono text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-accent">
                {intro.eyebrow}
              </span>
            </div>

            {/* Heading */}
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-[-0.025em] text-primary">
              {intro.title}
            </h3>

            {/* Supporting text */}
            <p className="mt-3 text-base sm:text-lg text-primary-muted leading-relaxed max-w-2xl font-normal">
              {intro.desc}
            </p>
          </motion.div>

          {/* 4 Wide Editorial Rows */}
          <div className="border-b border-border/70 dark:border-white/[0.08]">
            {principles.map((principle, idx) => {
              const isActive = activeRow === idx;

              return (
                <motion.article
                  key={principle.num}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-30px" }}
                  transition={{
                    duration: 0.5,
                    delay: shouldReduceMotion ? 0 : idx * 0.07,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  onMouseEnter={() => setActiveRow(idx)}
                  onMouseLeave={() => setActiveRow(null)}
                  onFocus={() => setActiveRow(idx)}
                  onBlur={() => setActiveRow(null)}
                  tabIndex={0}
                  className={`group relative border-t transition-all duration-300 py-8 sm:py-10 lg:py-12 px-3 sm:px-5 -mx-3 sm:-mx-5 rounded-xl focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                    isActive
                      ? "border-accent/40 bg-accent/[0.015]"
                      : "border-border/70 dark:border-white/[0.08] hover:border-accent/30 hover:bg-accent/[0.01]"
                  }`}
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 lg:gap-10 items-start">
                    
                    {/* Column 1: Principle number and category (technical label) */}
                    <div className="md:col-span-3 lg:col-span-3 flex items-center gap-2">
                      <span
                        className={`font-mono text-xs sm:text-[13px] font-semibold tracking-[0.2em] uppercase transition-colors duration-200 ${
                          isActive
                            ? "text-accent"
                            : "text-accent/90 group-hover:text-accent"
                        }`}
                      >
                        {principle.num} &mdash; {principle.category}
                      </span>
                    </div>

                    {/* Column 2: Large premium headline */}
                    <div className="md:col-span-5 lg:col-span-5">
                      <h4
                        className={`text-xl sm:text-2xl lg:text-[28px] font-bold tracking-tight leading-[1.25] transition-colors duration-200 ${
                          isActive
                            ? "text-white dark:text-[#FBFBFA]"
                            : "text-primary group-hover:text-white dark:group-hover:text-[#FBFBFA]"
                        }`}
                      >
                        {principle.headline}
                      </h4>
                    </div>

                    {/* Column 3: Supporting description */}
                    <div className="md:col-span-4 lg:col-span-4">
                      <p className="text-sm sm:text-[15px] text-primary-muted leading-relaxed font-normal">
                        {principle.description}
                      </p>
                    </div>

                  </div>
                </motion.article>
              );
            })}
          </div>

        </div>

      </div>
    </section>
  );
}
