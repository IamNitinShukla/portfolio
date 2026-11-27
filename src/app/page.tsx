"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";
import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import TechMarquee from "@/components/TechMarquee";
import Storytelling from "@/components/Storytelling";
import About from "@/components/About";
import Skills from "@/components/Skills";
import FeaturedProjects from "@/components/FeaturedProjects";
import ExperienceTimeline from "@/components/ExperienceTimeline";
import Education from "@/components/Education";
import Achievements from "@/components/Achievements";
import Contact from "@/components/Contact";
import CursorSpotlight from "@/components/CursorSpotlight";
import Intro from "@/components/Intro";
import PortfolioMascot from "@/components/PortfolioMascot";

// Defer CommandPalette modal until needed — reduces initial critical JS bundle
const CommandPalette = dynamic(() => import("@/components/CommandPalette"), {
  ssr: false,
});

export default function Home() {
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(true);

  // Check if intro has already been seen in this session or if user prefers reduced motion
  useEffect(() => {
    try {
      const seen = sessionStorage.getItem("portfolio_intro_seen");
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (seen === "true" || prefersReducedMotion) {
        setShowIntro(false);
      }
    } catch {
      // safe fallback if sessionStorage unavailable
    }
  }, []);

  const handleIntroComplete = () => {
    setShowIntro(false);
    try {
      sessionStorage.setItem("portfolio_intro_seen", "true");
    } catch {}
  };

  // Global ⌘K / Ctrl+K keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setTerminalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      {/* Feature 1: Isolated Cinematic Animated Website Entrance */}
      <AnimatePresence mode="wait">
        {showIntro && <Intro onComplete={handleIntroComplete} />}
      </AnimatePresence>

      {/* Feature 2: Cursor-Following Ambient Spotlight (Mounted behind homepage content) */}
      <CursorSpotlight />

      <main className="relative min-h-screen bg-transparent text-primary flex flex-col z-10 transition-colors duration-200">
        {/* Intelligently positioned sticky floating navigation */}
        <Navigation
          onOpenTerminal={() => setTerminalOpen(true)}
          onOpenContact={() => setContactModalOpen(true)}
        />

        {/* Hero Section */}
        <Hero onOpenContact={() => setContactModalOpen(true)} />

        {/* Marquee Technology Band */}
        <TechMarquee />

        {/* Creative Visual Storytelling / How I Build */}
        <Storytelling />

        {/* About Me Section */}
        <About />

        {/* Technical Expertise (7 Categorized Domains) */}
        <Skills />

        {/* Featured Projects & Case Studies (Carousel & Interactive Deep Dive) */}
        <FeaturedProjects />

        {/* Experience & Career Journey (Vertical Timeline) */}
        <ExperienceTimeline />

        {/* Academic Education Section */}
        <Education />

        {/* Achievements, Hackathons & Certifications */}
        <Achievements />

        {/* Contact, Meeting Scheduler & Direct Inquiry Form (Serves as the clean Yogender-inspired closing section) */}
        <Contact isOpen={contactModalOpen} onOpenChange={setContactModalOpen} />

        {/* Interactive Command Palette / Quick Terminal Modal (⌘K) */}
        <CommandPalette isOpen={terminalOpen} onClose={() => setTerminalOpen(false)} />

        {/* Animated Robot Mascot Companion */}
        <PortfolioMascot />
      </main>
    </>
  );
}
