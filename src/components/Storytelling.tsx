"use client";

import Image from "next/image";
import { portfolioData } from "@/data/portfolioData";
import { ArrowDownRight, Cpu, Zap, ShieldCheck, Sparkles } from "lucide-react";
import SpiderMascot from "@/components/SpiderMascot";

export default function Storytelling() {
  const icons = [
    <Cpu key="cpu" className="w-5 h-5 text-accent" />,
    <Zap key="zap" className="w-5 h-5 text-accent" />,
    <ShieldCheck key="shield" className="w-5 h-5 text-accent" />,
    <Sparkles key="sparkles" className="w-5 h-5 text-accent" />,
  ];

  return (
    <section id="philosophy" className="relative py-14 sm:py-20 lg:py-24 border-b border-border bg-transparent transition-colors overflow-hidden">
      {/* Background Accent Glow */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-accent/[0.04] blur-[160px] rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Kicker */}
        <div className="flex flex-col items-start mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface border border-border mb-4 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-primary-muted">
              {portfolioData.philosophy.eyebrow}
            </span>
          </div>

          <h2 className="text-4xl sm:text-6xl font-extrabold tracking-[-0.035em] text-primary">
            {portfolioData.philosophy.title}
          </h2>
        </div>

        {/* Central Creative Image Composition */}
        <div className="relative w-full aspect-[16/8.5] max-h-[480px] rounded-[28px] overflow-hidden border border-border mb-8 sm:mb-10 shadow-xl bg-surface-secondary group">
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

        {/* Editorial Quote */}
        <div className="mb-8 sm:mb-10 max-w-4xl">
          <p className="text-2xl sm:text-3xl md:text-4xl font-semibold text-primary leading-[1.25] tracking-tight">
            &ldquo;{portfolioData.philosophy.quote}&rdquo;
          </p>
        </div>

        {/* 4 Architectural Pillars Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {portfolioData.philosophy.pillars.map((pillar, idx) => (
            <div
              key={pillar.num}
              className="relative p-7 rounded-[22px] bg-surface hover:bg-surface-elevated border border-border hover:border-accent transition-all duration-300 group flex flex-col justify-between shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <span className="font-mono text-xs text-accent font-bold tracking-widest">
                    {"//"} {pillar.num}
                  </span>
                  <div className="p-2.5 rounded-xl bg-surface-secondary border border-border group-hover:border-accent transition-colors">
                    {icons[idx]}
                  </div>
                </div>

                <h3 className="text-2xl font-bold text-primary mb-3 flex items-center gap-1.5">
                  <span>{pillar.label}</span>
                  <ArrowDownRight className="w-4 h-4 text-accent opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:translate-y-0.5 transition-all" />
                </h3>

                <p className="text-sm text-primary-muted leading-relaxed">
                  {pillar.desc}
                </p>
              </div>

              {/* Decorative bottom bar on hover */}
              <div className="mt-7 pt-3.5 border-t border-border font-mono text-[10px] text-primary-subtle group-hover:text-accent font-semibold tracking-wider transition-colors">
                DIRECTIVE {pillar.num} · AUDITED
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
