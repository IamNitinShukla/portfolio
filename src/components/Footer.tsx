"use client";

import { portfolioData, socialLinks } from "@/data/portfolioData";
import { ArrowUp, Heart, Terminal, Sparkles, Github, Linkedin, Twitter, Mail } from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const navLinks = [
    { name: "Hero", href: "#hero" },
    { name: "About", href: "#about" },
    { name: "Skills", href: "#skills" },
    { name: "Work", href: "#work" },
    { name: "Experience", href: "#experience" },
    { name: "Education", href: "#education" },
    { name: "Achievements", href: "#achievements" },
    { name: "Contact", href: "#contact" },
  ];

  return (
    <footer className="relative py-10 sm:py-12 bg-transparent border-t border-border text-primary-muted transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Footer Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 pb-10 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-accent" />
              <span className="font-mono text-sm font-bold text-primary tracking-wider uppercase">
                {portfolioData.personal.name}
              </span>
              <span className="font-mono text-xs text-accent border-l border-border pl-2">
                {portfolioData.personal.devId}
              </span>
            </div>
            <p className="text-xs text-primary-muted max-w-sm">
              {portfolioData.personal.role} · Specialized in Artificial Intelligence, applied generative models, and resilient systems.
            </p>
          </div>

          {/* Quick Nav Links & Social Profiles */}
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-mono uppercase tracking-wider">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={(e) => {
                    e.preventDefault();
                    document.querySelector(link.href)?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="hover:text-accent transition-colors"
                >
                  {link.name}
                </a>
              ))}
            </div>

            {/* Social Profile Links */}
            <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-border/60 pt-4 md:pt-0 md:pl-6">
              <a
                href={socialLinks.github}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 flex items-center justify-center rounded-full bg-surface border border-border hover:border-accent text-primary-muted hover:text-accent hover:scale-105 active:scale-95 transition-all duration-200 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="GitHub Profile"
              >
                <Github className="w-3.5 h-3.5" />
              </a>
              <a
                href={socialLinks.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 flex items-center justify-center rounded-full bg-surface border border-border hover:border-accent text-primary-muted hover:text-accent hover:scale-105 active:scale-95 transition-all duration-200 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="LinkedIn Profile"
              >
                <Linkedin className="w-3.5 h-3.5" />
              </a>
              <a
                href={socialLinks.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 flex items-center justify-center rounded-full bg-surface border border-border hover:border-accent text-primary-muted hover:text-accent hover:scale-105 active:scale-95 transition-all duration-200 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="X Profile"
              >
                <Twitter className="w-3.5 h-3.5" />
              </a>
              <a
                href={socialLinks.emailUrl}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-surface border border-border hover:border-accent text-primary-muted hover:text-accent hover:scale-105 active:scale-95 transition-all duration-200 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Send Email"
              >
                <Mail className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Footer Row */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 text-primary-subtle">
            <span>© {currentYear} {portfolioData.personal.name}. All rights reserved.</span>
            <span>·</span>
            <span className="text-accent">{portfolioData.personal.origin}</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-primary-subtle hidden sm:inline">
              Built with Next.js &amp; Tailwind CSS
            </span>

            {/* Back to top button */}
            <button
              onClick={scrollToTop}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface hover:bg-surface-elevated border border-border hover:border-accent/40 text-primary-muted hover:text-primary transition-all text-xs"
              aria-label="Scroll back to top"
            >
              <span>Back to Top</span>
              <ArrowUp className="w-3.5 h-3.5 text-accent" />
            </button>
          </div>
        </div>

      </div>
    </footer>
  );
}
