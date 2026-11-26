"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { portfolioData, Project } from "@/data/portfolioData";
import { ArrowUpRight, Github, ExternalLink, ChevronLeft, ChevronRight, Layers, X, CheckCircle2, MoveHorizontal, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import SpiderMascot from "@/components/SpiderMascot";

export default function FeaturedProjects() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);

  const projects = portfolioData.projects;
  const activeProject = projects[activeIndex];

  // Auto-play / continuous slide showcase
  useEffect(() => {
    if (!autoPlay) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev === projects.length - 1 ? 0 : prev + 1));
    }, 4500);
    return () => clearInterval(interval);
  }, [autoPlay, projects.length]);

  // Escape key closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedProject) {
        setSelectedProject(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedProject]);

  const handlePrev = () => {
    setActiveIndex((prev) => (prev === 0 ? projects.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev === projects.length - 1 ? 0 : prev + 1));
  };

  const getProjectGlow = (id: string) => {
    switch (id) {
      case "lexgenai":
        return "glow-amber";
      case "krishi-setu":
        return "glow-emerald";
      case "ai-video-generator":
        return "glow-violet";
      case "rookdb":
        return "glow-cyan";
      default:
        return "glow-accent";
    }
  };

  return (
    <section id="work" className="relative py-14 sm:py-20 lg:py-24 border-b border-border bg-transparent transition-colors overflow-hidden">
      {/* Background ambient radial glow matching active project */}
      <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 w-[750px] h-[450px] bg-accent/[0.04] blur-[170px] rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 sm:mb-10 gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface border border-border mb-4 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-primary-muted">
                • SELECTED WORK
              </span>
            </div>

            <h2 className="text-4xl sm:text-6xl font-extrabold tracking-[-0.035em] text-primary">
              Featured Builds &amp; Case Studies
            </h2>
          </div>

          {/* Top Pagination Pill Tracker (--- • ---) */}
          <div className="flex items-center gap-3 self-start sm:self-end">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-border shadow-sm">
              {projects.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveIndex(idx)}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    activeIndex === idx ? "w-7 bg-accent" : "w-1.5 bg-primary-muted/30 hover:bg-primary-muted/60"
                  )}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Thumbnail Selector Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-8">
          {projects.map((proj, idx) => (
            <button
              key={proj.id}
              onClick={() => setActiveIndex(idx)}
              className={cn(
                "p-4 rounded-2xl text-left transition-all duration-200 border flex flex-col justify-between group shadow-sm",
                activeIndex === idx
                  ? "bg-surface border-accent shadow-md ring-1 ring-accent/30"
                  : "bg-surface/60 border-border hover:bg-surface hover:border-border-strong"
              )}
            >
              <div>
                <span className="font-mono text-[10px] text-accent font-bold tracking-widest uppercase">
                  {"//"} 0{idx + 1}
                </span>
                <p className="font-bold text-sm text-primary mt-1 truncate group-hover:text-accent transition-colors">
                  {proj.title}
                </p>
                <p className="text-[11px] text-primary-muted truncate mt-0.5">{proj.category}</p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-border/80 flex items-center justify-between">
                <span className="font-mono text-[9px] text-primary-subtle tracking-wider uppercase">VIEW STUDY</span>
                <span className={cn("h-1.5 w-1.5 rounded-full", activeIndex === idx ? "bg-accent" : "bg-transparent")} />
              </div>
            </button>
          ))}
        </div>

        {/* Active Featured Project Hero Card */}
        <div
          className={cn(
            "rounded-[32px] bg-surface border border-border overflow-hidden shadow-xl transition-shadow duration-500",
            getProjectGlow(activeProject.id)
          )}
        >
          <AnimatePresence mode="popLayout">
            <motion.div
              key={activeProject.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              {/* Top Project Visual Preview */}
              <div className="relative aspect-video max-h-[500px] w-full bg-surface-secondary border-b border-border overflow-hidden group">
                <Image
                  src={activeProject.previewImage}
                  alt={activeProject.title}
                  fill
                  loading="lazy"
                  unoptimized
                  className="object-contain sm:object-cover object-center group-hover:scale-[1.015] transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent opacity-60" />

                {/* Floating Badges */}
                <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2">
                  <span className="px-3.5 py-1 rounded-full bg-surface/85 backdrop-blur-md border border-border text-xs font-mono text-accent font-semibold shadow-sm">
                    {activeProject.kicker}
                  </span>
                  <span className="px-3.5 py-1 rounded-full bg-surface/85 backdrop-blur-md border border-border text-xs font-mono text-primary-muted shadow-sm">
                    {activeProject.category}
                  </span>
                </div>

                {/* Architecture Deep Dive Pill on preview */}
                <div className="absolute bottom-4 right-4">
                  <button
                    onClick={() => setSelectedProject(activeProject)}
                    className="px-4 py-2 rounded-full bg-surface/90 backdrop-blur-md border border-border hover:border-accent text-xs font-semibold text-primary hover:text-accent transition-all flex items-center gap-1.5 shadow-md"
                  >
                    <Layers className="w-3.5 h-3.5 text-accent" />
                    <span>Inspect Architecture</span>
                  </button>
                </div>
              </div>

              {/* Bottom Details & Specifications Layout */}
              <div className="p-6 sm:p-8 lg:p-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  
                  {/* Left: Title, Description, and CTAs */}
                  <div className="lg:col-span-7 flex flex-col items-start">
                    <div className="flex items-center gap-2 mb-2 font-mono text-xs text-accent uppercase font-bold tracking-wider">
                      <span className="h-2 w-2 rounded-full bg-accent" />
                      <span>{activeProject.kicker}</span>
                    </div>

                    <h3 className="text-3xl sm:text-5xl font-extrabold tracking-[-0.03em] text-primary mb-4">
                      {activeProject.title}
                    </h3>

                    <p className="text-sm sm:text-base text-primary-muted leading-relaxed mb-7 max-w-xl">
                      {activeProject.shortDescription}
                    </p>

                    {/* Action Link Buttons */}
                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                      {/* Case Study / Live Demo Primary CTA */}
                      <a
                        href={activeProject.liveDemoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-accent hover:bg-accent-hover text-white dark:text-[#101110] font-bold text-xs tracking-wider uppercase transition-all duration-200 shadow-md shadow-accent/20"
                      >
                        <span>Case Study</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </a>

                      {/* GitHub Code Link */}
                      <a
                        href={activeProject.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 rounded-full bg-surface-secondary hover:bg-surface border border-border hover:border-accent text-primary hover:text-accent transition-all shadow-sm"
                        aria-label="View Source Repository"
                      >
                        <Github className="w-4 h-4" />
                      </a>

                      {/* Architecture Modal Trigger */}
                      <button
                        onClick={() => setSelectedProject(activeProject)}
                        className="inline-flex items-center gap-1.5 px-5 py-3 rounded-full bg-surface-secondary hover:bg-surface border border-border hover:border-accent text-primary-muted hover:text-primary text-xs font-semibold tracking-wider uppercase transition-all shadow-sm"
                      >
                        <span>System Specs</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Right: 3-Metric Spec Grid & Tech Stack */}
                  <div className="lg:col-span-5 flex flex-col gap-6">
                    {/* 3 Metrics Box */}
                    <div className="grid grid-cols-3 gap-2.5 p-4 rounded-2xl bg-surface-secondary border border-border shadow-sm">
                      {activeProject.metrics.map((metric, idx) => (
                        <div key={idx} className="flex flex-col text-center">
                          <span className="font-mono text-[9px] uppercase tracking-wider text-primary-muted mb-1 font-semibold truncate">
                            {metric.label}
                          </span>
                          <span className="font-extrabold text-sm sm:text-base text-accent font-mono">
                            {metric.value}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Tech Stack Pills */}
                    <div>
                      <p className="font-mono text-xs uppercase tracking-widest text-primary-muted mb-2.5 font-bold">
                        PRODUCTION STACK:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {activeProject.techStack.map((tech) => (
                          <span
                            key={tech}
                            className="px-3 py-1.5 rounded-lg bg-surface-secondary border border-border text-xs font-mono text-primary shadow-sm"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Bottom Interactive Toolbar (Persistent, Stable & Fixed Position) */}
          <div className="px-6 pb-6 sm:px-8 sm:pb-8 lg:px-10 lg:pb-10 pt-2">
            <div className="pt-6 border-t border-border flex flex-wrap items-center justify-between gap-4">
              
              <div className="flex items-center gap-3">
                {/* Drag to browse pill */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-secondary border border-border text-[11px] font-mono text-primary-muted">
                  <MoveHorizontal className="w-3.5 h-3.5 text-accent" />
                  <span>DRAG TO BROWSE</span>
                </div>

                {/* Auto flow toggle */}
                <button
                  onClick={() => setAutoPlay(!autoPlay)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono transition-all border shadow-sm",
                    autoPlay
                      ? "bg-accent/15 border-accent text-accent font-bold"
                      : "bg-surface-secondary border-border text-primary-muted hover:text-primary"
                  )}
                >
                  {autoPlay ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  <span>{autoPlay ? "AUTO-FLOW ON" : "AUTO-FLOW"}</span>
                </button>
              </div>

              {/* Arrow navigation buttons + Robotic Spider Mascot */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrev}
                    className="p-3 rounded-full bg-surface-secondary hover:bg-surface border border-border hover:border-accent text-primary transition-all shadow-sm"
                    aria-label="Previous Project"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleNext}
                    className="p-3 rounded-full bg-surface-secondary hover:bg-surface border border-border hover:border-accent text-primary transition-all shadow-sm"
                    aria-label="Next Project"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Spider mascot hanging near the controls */}
                <div className="hidden sm:block">
                  <SpiderMascot size={46} />
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Modal: Project Deep Dive */}
        {selectedProject && (
          <div
            id="architecture-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Project Architecture Specifications"
            onClick={() => setSelectedProject(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-background/85 backdrop-blur-xl animate-in fade-in duration-200 cursor-pointer"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl rounded-[32px] bg-surface border border-border p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto cursor-default"
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedProject(null)}
                className="absolute top-5 right-5 p-2 rounded-full bg-surface-secondary border border-border text-primary-muted hover:text-primary transition-colors shadow-sm"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 mb-2 font-mono text-xs text-accent font-bold">
                <span className="h-2 w-2 rounded-full bg-accent" />
                <span>{selectedProject.kicker}</span>
              </div>

              <h3 className="text-3xl font-extrabold text-primary mb-3">
                {selectedProject.title}
              </h3>

              <p className="text-sm text-primary-muted leading-relaxed mb-6">
                {selectedProject.fullDescription}
              </p>

              {/* Highlights */}
              <div className="mb-6">
                <h4 className="font-mono text-xs uppercase tracking-wider text-primary font-bold mb-3">
                  Key Engineering Highlights
                </h4>
                <ul className="flex flex-col gap-2.5">
                  {selectedProject.highlights.map((highlight, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-primary">
                      <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Tech Stack */}
              <div className="mb-8">
                <h4 className="font-mono text-xs uppercase tracking-wider text-primary font-bold mb-3">
                  Production Stack
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedProject.techStack.map((t) => (
                    <span key={t} className="px-3 py-1.5 rounded-lg bg-surface-secondary border border-border text-xs font-mono text-primary-muted">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-border">
                <a
                  href={selectedProject.liveDemoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3.5 rounded-xl bg-accent hover:bg-accent-hover text-white dark:text-[#101110] font-bold text-xs tracking-wider uppercase transition-all shadow-md"
                >
                  <span>Launch Live Demo</span>
                  <ArrowUpRight className="w-4 h-4" />
                </a>

                <a
                  href={selectedProject.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3.5 rounded-xl bg-surface-secondary hover:bg-surface border border-border text-primary text-xs font-semibold transition-all shadow-sm"
                >
                  <Github className="w-4 h-4 text-accent" />
                  <span>View Repository</span>
                </a>
              </div>
            </div>
          </div>
        )}

      </div>
    </section>
  );
}
