"use client";

import { portfolioData } from "@/data/portfolioData";
import { GraduationCap, BrainCircuit, Terminal, MapPin, Globe } from "lucide-react";

export default function About() {
  const stats = [
    { label: "ACADEMIC FOCUS", value: "Artificial Intelligence" },
    { label: "DEGREE PROGRAM", value: "B.Tech Computer Science" },
    { label: "SYSTEMS PHILOSOPHY", value: "Production-First & Minimal" },
    { label: "INTEREST AREAS", value: "Generative AI · Backends" },
  ];

  return (
    <section id="about" className="relative py-14 sm:py-20 lg:py-24 border-b border-border bg-transparent transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Kicker */}
        <div className="flex flex-col items-start mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface border border-border mb-4 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-primary-muted">
              About Me
            </span>
          </div>

          <h2 className="text-4xl sm:text-6xl font-extrabold tracking-[-0.035em] text-primary">
            Engineering at the frontier of AI &amp; Software.
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          
          {/* Left Column: Narrative & Philosophy */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <p className="text-lg sm:text-xl text-primary leading-relaxed font-normal">
              {portfolioData.personal.aboutBio1}
            </p>

            <p className="text-base text-primary-muted leading-relaxed">
              {portfolioData.personal.aboutBio2}
            </p>

            <div className="mt-4 p-7 rounded-[26px] bg-surface border border-border flex flex-col gap-4 shadow-sm">
              <div className="flex items-center gap-2 text-accent font-mono text-xs uppercase tracking-wider font-bold">
                <BrainCircuit className="w-4 h-4" />
                <span>Primary Technical Focus Areas</span>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-primary font-medium">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  <span>Autonomous AI Agents &amp; RAG</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  <span>Scalable Backend Systems &amp; APIs</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  <span>High-Velocity Full-Stack Web</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  <span>Distributed Storage &amp; Work Queues</span>
                </li>
              </ul>
            </div>

            {/* Academic Snapshot Pill */}
            <div className="p-7 rounded-[26px] bg-surface border border-border flex items-start gap-5 shadow-sm">
              <div className="p-3.5 rounded-2xl bg-surface-secondary border border-border text-accent">
                <GraduationCap className="w-7 h-7" />
              </div>
              <div>
                <h4 className="font-bold text-primary text-lg mb-1">
                  {portfolioData.education.degree}
                </h4>
                <p className="text-sm text-accent font-mono font-semibold mb-1">
                  {portfolioData.education.specialization}
                </p>
                <p className="text-xs text-primary-muted">
                  {portfolioData.education.institution} · {portfolioData.education.period}
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Engineering Environment & Specs Card */}
          <div className="lg:col-span-5">
            <div className="rounded-[28px] bg-surface border border-border p-7 shadow-sm">
              {/* Terminal Title Bar */}
              <div className="flex items-center justify-between pb-4 border-b border-border mb-5">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-[#ff5f56]" />
                  <div className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
                  <div className="h-3 w-3 rounded-full bg-[#27c93f]" />
                  <span className="ml-2 font-mono text-xs text-primary-muted font-semibold">developer.config // specs</span>
                </div>
                <span className="font-mono text-[11px] text-accent font-bold">READY</span>
              </div>

              {/* Specs Grid */}
              <div className="flex flex-col gap-3 font-mono text-xs">
                {stats.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-surface-secondary border border-border flex items-center justify-between"
                  >
                    <span className="text-primary-muted">{item.label}</span>
                    <span className="font-bold text-primary text-right">{item.value}</span>
                  </div>
                ))}

                <div className="p-3.5 rounded-xl bg-surface-secondary border border-border flex items-center justify-between">
                  <span className="text-primary-muted">LOCATION // ORIGIN</span>
                  <span className="flex items-center gap-1.5 text-accent font-semibold">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{portfolioData.personal.location}</span>
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-secondary border border-border flex items-center justify-between">
                  <span className="text-primary-muted">TIMEZONE</span>
                  <span className="flex items-center gap-1.5 text-primary font-semibold">
                    <Globe className="w-3.5 h-3.5 text-accent" />
                    <span>{portfolioData.personal.timezone}</span>
                  </span>
                </div>
              </div>

              {/* Mini Terminal Code Snippet */}
              <div className="mt-5 p-4 rounded-xl bg-surface-secondary border border-border font-mono text-[11px] text-primary-muted">
                <div className="flex items-center gap-1.5 text-accent mb-2 font-bold">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>$ cat ethos.txt</span>
                </div>
                <p className="text-primary-muted leading-relaxed">
                  &quot;Ship working software. Measure latency. Validate with real users. Refactor mercilessly.&quot;
                </p>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
