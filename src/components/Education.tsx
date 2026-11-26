"use client";

import { portfolioData } from "@/data/portfolioData";
import { GraduationCap, Award, BookOpen, Calendar, MapPin } from "lucide-react";

export default function Education() {
  const edu = portfolioData.education;

  return (
    <section id="education" className="relative py-14 sm:py-20 lg:py-24 border-b border-border bg-transparent transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col items-start mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface border border-border mb-4 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-primary-muted">
              ACADEMIC BACKGROUND
            </span>
          </div>

          <h2 className="text-4xl sm:text-6xl font-extrabold tracking-[-0.035em] text-primary">
            Education &amp; Foundations.
          </h2>
        </div>

        {/* Education Highlight Card */}
        <div className="p-8 sm:p-11 rounded-[32px] bg-surface border border-border shadow-sm hover:shadow-md transition-all relative overflow-hidden">
          {/* Subtle Accent Glow */}
          <div className="pointer-events-none absolute top-0 right-0 w-[450px] h-[450px] bg-accent/[0.04] blur-[140px] rounded-full" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative z-10">
            
            {/* Left Degree Details */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="p-4 rounded-2xl bg-surface-secondary border border-border text-accent shadow-sm">
                  <GraduationCap className="w-8 h-8" />
                </div>
                <div>
                  <span className="font-mono text-xs text-accent uppercase tracking-widest font-bold">
                    UNDERGRADUATE DEGREE
                  </span>
                  <h3 className="text-2xl sm:text-4xl font-extrabold text-primary">
                    {edu.degree}
                  </h3>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-surface-secondary border border-border inline-flex flex-col gap-1 max-w-md shadow-sm">
                <span className="font-mono text-xs text-accent font-bold">
                  {edu.specialization}
                </span>
                <span className="text-sm text-primary font-semibold">
                  {edu.institution}
                </span>
              </div>

              <p className="text-sm sm:text-base text-primary-muted leading-relaxed">
                {edu.summary}
              </p>

              <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-primary-muted pt-2">
                <div className="flex items-center gap-1.5 bg-surface-secondary px-3.5 py-1.5 rounded-xl border border-border">
                  <Calendar className="w-3.5 h-3.5 text-accent" />
                  <span>{edu.period}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-surface-secondary px-3.5 py-1.5 rounded-xl border border-border">
                  <MapPin className="w-3.5 h-3.5 text-accent" />
                  <span>{edu.location}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-accent/15 text-accent px-3.5 py-1.5 rounded-xl border border-accent/30 font-bold">
                  <Award className="w-3.5 h-3.5" />
                  <span>{edu.grade}</span>
                </div>
              </div>
            </div>

            {/* Right Relevant Coursework */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-primary font-bold">
                <BookOpen className="w-4 h-4 text-accent" />
                <span>Core Computer Science &amp; AI Coursework</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {edu.coursework.map((course, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-surface-secondary border border-border hover:border-accent text-xs text-primary font-semibold transition-colors flex items-center gap-2.5 shadow-sm"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                    <span>{course}</span>
                  </div>
                ))}
              </div>

              <div className="p-3.5 rounded-xl bg-surface-secondary/50 border border-border/70 text-[11px] font-mono text-primary-muted">
                {"//"} Note: Coursework, institution name, and metrics are fully configurable in <code className="text-accent font-semibold">src/data/portfolioData.ts</code>.
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
