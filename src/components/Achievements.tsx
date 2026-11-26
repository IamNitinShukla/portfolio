"use client";

import { portfolioData } from "@/data/portfolioData";
import { Trophy, Award, GitPullRequest, BookmarkCheck, ExternalLink } from "lucide-react";

export default function Achievements() {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Hackathon":
        return <Trophy className="w-5 h-5 text-accent" />;
      case "Certification":
        return <Award className="w-5 h-5 text-accent" />;
      case "Open Source":
        return <GitPullRequest className="w-5 h-5 text-accent" />;
      default:
        return <BookmarkCheck className="w-5 h-5 text-accent" />;
    }
  };

  return (
    <section id="achievements" className="relative py-14 sm:py-20 lg:py-24 border-b border-border bg-transparent transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 sm:mb-10 gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface border border-border mb-4 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-primary-muted">
                RECOGNITION &amp; MILESTONES
              </span>
            </div>

            <h2 className="text-4xl sm:text-6xl font-extrabold tracking-[-0.035em] text-primary">
              Achievements &amp; Certifications.
            </h2>
          </div>

          <p className="text-sm text-primary-muted max-w-md font-mono">
            {"//"} Competitive hackathons, specialized certifications, and open-source contributions.
          </p>
        </div>

        {/* Achievements Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {portfolioData.achievements.map((item) => (
            <div
              key={item.id}
              className="p-7 sm:p-9 rounded-[28px] bg-surface border border-border hover:border-accent transition-all duration-300 flex flex-col justify-between group shadow-sm hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-border mb-5">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-surface-secondary border border-border group-hover:border-accent transition-colors">
                      {getCategoryIcon(item.category)}
                    </div>
                    <div>
                      <span className="font-mono text-[10px] text-accent tracking-widest uppercase font-bold">
                        {item.category}
                      </span>
                      <p className="font-mono text-xs text-primary-muted">
                        {item.issuer} · {item.date}
                      </p>
                    </div>
                  </div>

                  {item.badge && (
                    <span className="px-3 py-1 rounded-full bg-accent/15 border border-accent/30 font-mono text-xs text-accent font-bold">
                      {item.badge}
                    </span>
                  )}
                </div>

                <h3 className="text-xl sm:text-2xl font-bold text-primary mb-3 group-hover:text-accent transition-colors">
                  {item.title}
                </h3>

                <p className="text-sm text-primary-muted leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="mt-7 pt-3.5 border-t border-border/80 flex items-center justify-between font-mono text-[11px] text-primary-subtle">
                <span>STATUS: VERIFIED PLACEHOLDER</span>
                <span className="text-accent flex items-center gap-1 font-bold group-hover:underline">
                  <span>Details</span>
                  <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
