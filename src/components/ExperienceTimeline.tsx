"use client";

import { portfolioData } from "@/data/portfolioData";
import { Calendar, MapPin, CheckCircle2 } from "lucide-react";

export default function ExperienceTimeline() {
  return (
    <section id="experience" className="relative py-14 sm:py-20 lg:py-24 border-b border-border bg-transparent transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 sm:mb-10 gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface border border-border mb-4 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-primary-muted">
                CAREER &amp; ENGINEERING TRACK RECORD
              </span>
            </div>

            <h2 className="text-4xl sm:text-6xl font-extrabold tracking-[-0.035em] text-primary">
              Work Experience &amp; Journey.
            </h2>
          </div>

          <p className="text-sm text-primary-muted max-w-md font-mono">
            {"//"} Practical engineering track record building production systems, APIs, and AI models.
          </p>
        </div>

        {/* Vertical Timeline */}
        <div className="relative pl-6 sm:pl-10 border-l border-border flex flex-col gap-8 sm:gap-10">
          {portfolioData.experience.map((exp) => (
            <div key={exp.id} className="relative group">
              {/* Timeline Connector Node */}
              <div className="absolute -left-[31px] sm:-left-[47px] top-1.5 h-4 w-4 rounded-full bg-surface border-2 border-accent flex items-center justify-center group-hover:scale-125 transition-transform shadow-[0_0_12px_var(--accent-glow)]">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              </div>

              {/* Experience Card */}
              <div className="p-7 sm:p-9 rounded-[28px] bg-surface border border-border group-hover:border-accent transition-all duration-300 shadow-sm hover:shadow-md">
                
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-border mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="px-3 py-0.5 rounded-full bg-accent/10 border border-accent/25 font-mono text-[10px] text-accent font-bold uppercase tracking-wider">
                        {exp.employmentType}
                      </span>
                      <span className="font-mono text-xs text-primary-muted flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-accent" />
                        {exp.location}
                      </span>
                    </div>

                    <h3 className="text-2xl sm:text-3xl font-extrabold text-primary">
                      {exp.role}
                    </h3>
                    <p className="text-sm text-primary-muted font-semibold mt-0.5">
                      {exp.organization}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono text-xs text-primary-muted bg-surface-secondary px-3.5 py-1.5 rounded-xl border border-border self-start sm:self-center font-semibold">
                    <Calendar className="w-3.5 h-3.5 text-accent" />
                    <span>{exp.period}</span>
                  </div>
                </div>

                {/* Narrative description */}
                <p className="text-sm sm:text-base text-primary-muted leading-relaxed mb-6">
                  {exp.description}
                </p>

                {/* Bulleted Achievements */}
                <div className="mb-7">
                  <h4 className="font-mono text-xs uppercase tracking-widest text-primary font-bold mb-3.5">
                    Impact &amp; Key Responsibilities:
                  </h4>
                  <ul className="flex flex-col gap-3">
                    {exp.achievements.map((ach, i) => (
                      <li key={i} className="flex items-start gap-3 text-xs sm:text-sm text-primary leading-relaxed">
                        <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                        <span>{ach}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Tech Badges */}
                <div className="pt-5 border-t border-border/80 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-primary-muted mr-1 font-bold">
                    TECH STACK:
                  </span>
                  {exp.technologies.map((t) => (
                    <span
                      key={t}
                      className="px-3 py-1 rounded-lg bg-surface-secondary border border-border text-xs font-mono text-primary-muted hover:text-primary transition-colors"
                    >
                      {t}
                    </span>
                  ))}
                </div>

              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
