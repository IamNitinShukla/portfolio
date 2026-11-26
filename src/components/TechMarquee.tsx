"use client";

import { portfolioData } from "@/data/portfolioData";
import { CodeXml } from "lucide-react";

export default function TechMarquee() {
  const items = portfolioData.techMarquee;

  return (
    <div
      className="group relative w-full border-y border-border/60 dark:border-white/[0.06] bg-background dark:bg-[#0c0d0c] py-3 sm:py-3.5 -mt-px overflow-hidden select-none z-10 transition-colors duration-200"
      aria-label="Technology Stack"
    >
      {/* Edge gradient fade masks (subtle, seamless blend into light and dark backgrounds) */}
      <div
        className="pointer-events-none absolute left-0 top-0 bottom-0 w-14 sm:w-28 bg-gradient-to-r from-background dark:from-[#0c0d0c] to-transparent z-10"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute right-0 top-0 bottom-0 w-14 sm:w-28 bg-gradient-to-l from-background dark:from-[#0c0d0c] to-transparent z-10"
        aria-hidden="true"
      />

      {/* Continuous Horizontal Ticker Tracks */}
      <div className="flex w-max will-change-transform">
        {/* Track 1 (Primary for Accessibility) */}
        <div className="flex shrink-0 items-center gap-8 sm:gap-12 md:gap-14 pr-8 sm:pr-12 md:pr-14 animate-ticker group-hover:[animation-play-state:paused] motion-reduce:animate-none will-change-transform">
          {items.map((tech, index) => (
            <div
              key={`tech-primary-${tech}-${index}`}
              className="inline-flex items-center gap-2 shrink-0 select-none group/item cursor-default"
            >
              <CodeXml
                className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary-subtle/70 group-hover/item:text-accent transition-colors duration-200 shrink-0"
                strokeWidth={2.2}
                aria-hidden="true"
              />
              <span className="font-mono text-[11px] sm:text-xs tracking-wider uppercase font-medium text-primary-muted group-hover/item:text-primary transition-colors duration-200 whitespace-nowrap">
                {tech}
              </span>
            </div>
          ))}
        </div>

        {/* Track 2 (Seamless loop replica) */}
        <div
          className="flex shrink-0 items-center gap-8 sm:gap-12 md:gap-14 pr-8 sm:pr-12 md:pr-14 animate-ticker group-hover:[animation-play-state:paused] motion-reduce:animate-none will-change-transform"
          aria-hidden="true"
        >
          {items.map((tech, index) => (
            <div
              key={`tech-dup-1-${tech}-${index}`}
              className="inline-flex items-center gap-2 shrink-0 select-none group/item cursor-default"
            >
              <CodeXml
                className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary-subtle/70 group-hover/item:text-accent transition-colors duration-200 shrink-0"
                strokeWidth={2.2}
                aria-hidden="true"
              />
              <span className="font-mono text-[11px] sm:text-xs tracking-wider uppercase font-medium text-primary-muted group-hover/item:text-primary transition-colors duration-200 whitespace-nowrap">
                {tech}
              </span>
            </div>
          ))}
        </div>

        {/* Track 3 (Wide-screen safeguard replica for ultra-wide displays) */}
        <div
          className="flex shrink-0 items-center gap-8 sm:gap-12 md:gap-14 pr-8 sm:pr-12 md:pr-14 animate-ticker group-hover:[animation-play-state:paused] motion-reduce:animate-none will-change-transform"
          aria-hidden="true"
        >
          {items.map((tech, index) => (
            <div
              key={`tech-dup-2-${tech}-${index}`}
              className="inline-flex items-center gap-2 shrink-0 select-none group/item cursor-default"
            >
              <CodeXml
                className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary-subtle/70 group-hover/item:text-accent transition-colors duration-200 shrink-0"
                strokeWidth={2.2}
                aria-hidden="true"
              />
              <span className="font-mono text-[11px] sm:text-xs tracking-wider uppercase font-medium text-primary-muted group-hover/item:text-primary transition-colors duration-200 whitespace-nowrap">
                {tech}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
