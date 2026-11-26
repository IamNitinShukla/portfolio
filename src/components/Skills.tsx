"use client";

import { useState } from "react";
import { portfolioData } from "@/data/portfolioData";
import { Code, Brain, Cpu, Server, Layout, Database, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Skills() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const getCategoryIcon = (id: string) => {
    switch (id) {
      case "programming-languages":
        return <Code className="w-4 h-4 text-accent" />;
      case "ai-machine-learning":
        return <Brain className="w-4 h-4 text-accent" />;
      case "generative-ai-llms":
        return <Cpu className="w-4 h-4 text-accent" />;
      case "backend-development":
        return <Server className="w-4 h-4 text-accent" />;
      case "frontend-development":
        return <Layout className="w-4 h-4 text-accent" />;
      case "databases-cloud":
        return <Database className="w-4 h-4 text-accent" />;
      case "development-tools":
        return <Wrench className="w-4 h-4 text-accent" />;
      default:
        return <Code className="w-4 h-4 text-accent" />;
    }
  };

  const categoriesToDisplay =
    selectedCategory === "all"
      ? portfolioData.skillCategories
      : portfolioData.skillCategories.filter((c) => c.id === selectedCategory);

  return (
    <section id="skills" className="relative py-14 sm:py-20 lg:py-24 border-b border-border bg-transparent transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 sm:mb-10 gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface border border-border mb-4 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-primary-muted">
                CORE EXPERTISE &amp; TECHNICAL SKILLS
              </span>
            </div>

            <h2 className="text-4xl sm:text-6xl font-extrabold tracking-[-0.035em] text-primary">
              Disciplined stack for applied AI &amp; systems.
            </h2>
          </div>

          <p className="text-sm text-primary-muted max-w-md font-mono">
            {"//"} 7 specialization domains spanning low-level algorithms, neural networks, and scalable web infrastructure.
          </p>
        </div>

        {/* Category Tabs Filter */}
        <div className="flex flex-wrap items-center gap-2 mb-10 pb-4 border-b border-border/80 overflow-x-auto">
          <button
            onClick={() => setSelectedCategory("all")}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-mono font-bold tracking-wider uppercase transition-all whitespace-nowrap shadow-sm",
              selectedCategory === "all"
                ? "bg-accent text-white dark:text-[#101110] shadow-md"
                : "bg-surface hover:bg-surface-elevated text-primary-muted hover:text-primary border border-border"
            )}
          >
            All Categories ({portfolioData.skillCategories.length})
          </button>

          {portfolioData.skillCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(selectedCategory === cat.id ? "all" : cat.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono font-semibold tracking-wider uppercase transition-all whitespace-nowrap shadow-sm",
                selectedCategory === cat.id
                  ? "bg-accent text-white dark:text-[#101110] font-bold shadow-md"
                  : "bg-surface hover:bg-surface-elevated text-primary-muted hover:text-primary border border-border"
              )}
            >
              <span className={selectedCategory === cat.id ? "text-white/80 dark:text-[#101110]/80 font-bold" : "text-accent"}>
                {cat.number}
              </span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categoriesToDisplay.map((category) => (
            <div
              key={category.id}
              className="p-7 rounded-[26px] bg-surface border border-border hover:border-accent transition-all duration-300 flex flex-col justify-between group shadow-sm hover:shadow-md"
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-surface-secondary border border-border group-hover:border-accent transition-colors">
                      {getCategoryIcon(category.id)}
                    </div>
                    <div>
                      <span className="font-mono text-[10px] text-accent tracking-widest uppercase font-bold">
                        CATEGORY {category.number}
                      </span>
                      <h3 className="font-bold text-base text-primary leading-tight">
                        {category.name}
                      </h3>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-primary-muted mb-5 leading-relaxed">
                  {category.description}
                </p>

                {/* Skill Pills */}
                <div className="flex flex-wrap gap-2">
                  {category.skills.map((skill) => (
                    <div
                      key={skill.name}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all",
                        skill.featured
                          ? "bg-surface-secondary border border-accent/40 text-primary font-medium hover:border-accent"
                          : "bg-surface-secondary/70 border border-border text-primary-muted hover:text-primary hover:border-border-strong"
                      )}
                    >
                      {skill.featured && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                      <span>{skill.name}</span>
                      {skill.level && (
                        <span className="text-[10px] text-primary-subtle opacity-80">
                          · {skill.level}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Card Footer */}
              <div className="mt-6 pt-3.5 border-t border-border/80 flex items-center justify-between font-mono text-[10px] text-primary-muted">
                <span>{category.skills.length} TECHNOLOGIES</span>
                <span className="text-accent group-hover:translate-x-0.5 transition-transform font-bold">EXP // READY</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
