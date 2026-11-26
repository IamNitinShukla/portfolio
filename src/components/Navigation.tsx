"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { portfolioData } from "@/data/portfolioData";
import { Menu, X, Terminal, ArrowUpRight, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/ThemeToggle";

interface NavigationProps {
  onOpenTerminal?: () => void;
  onOpenContact?: () => void;
}

export default function Navigation({ onOpenTerminal, onOpenContact }: NavigationProps) {
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Philosophy item completely removed per specification
  const navLinks = [
    { name: "About", href: "#about" },
    { name: "Skills", href: "#skills" },
    { name: "Work", href: "#work" },
    { name: "Experience", href: "#experience" },
    { name: "Contact", href: "#contact" },
  ];

  // In compact scrolled state: display ONLY About, Work, Experience, Contact (Skills removed from scrolled pill)
  const visibleNavLinks = scrolled
    ? navLinks.filter((l) => l.name !== "Skills")
    : navLinks;

  // Scroll detection and active section observer
  useEffect(() => {
    const handleScroll = () => {
      // Threshold: morphs into floating pill when scrolled > 60px
      setScrolled(window.scrollY > 60);

      const sections = ["hero", "about", "skills", "work", "experience", "education", "achievements", "contact"];
      const scrollPos = window.scrollY + 220;

      for (const sectionId of sections) {
        const el = document.getElementById(sectionId);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPos >= top && scrollPos < top + height) {
            setActiveSection(sectionId);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll and listen for Escape key when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setMobileMenuOpen(false);
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [mobileMenuOpen]);

  const handleScrollTo = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <>
      {/* Accessible Skip Link (WCAG 2.4.1) */}
      <a
        href="#hero"
        onClick={(e) => handleScrollTo(e, "#hero")}
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-accent focus:text-white dark:focus:text-[#101110] focus:font-bold focus:text-xs focus:font-mono focus:rounded-full focus:shadow-2xl focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Main Navigation Header: Smoothly morphs from full-width to centered floating pill on scroll */}
      <header className="fixed top-0 inset-x-0 z-50 flex justify-center pointer-events-none">
        <motion.div
          layout
          transition={{
            layout: { duration: 0.36, ease: [0.16, 1, 0.3, 1] },
          }}
          className={cn(
            "pointer-events-auto flex items-center justify-between transition-colors duration-300",
            scrolled
              ? "mt-3 sm:mt-4 md:mt-5 px-4 sm:px-6 py-2 sm:py-2.5 rounded-full bg-surface/90 dark:bg-[#121312]/92 backdrop-blur-xl border border-border/80 dark:border-white/[0.08] shadow-xl shadow-black/20 gap-4 lg:gap-7 w-[calc(100%-1.5rem)] sm:w-auto"
              : "mt-0 w-full max-w-7xl px-4 sm:px-6 lg:px-12 py-4 sm:py-5 lg:py-6 bg-transparent border border-transparent rounded-full"
          )}
        >
          {/* Left: Brand / Logo */}
          <motion.a
            layout
            transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
            href="#hero"
            onClick={(e) => handleScrollTo(e, "#hero")}
            className="font-bold tracking-[0.13em] uppercase text-primary hover:text-accent transition-colors select-none whitespace-nowrap text-[13.5px] sm:text-[15.5px] md:text-base pl-1"
          >
            NITIN SHUKLA
          </motion.a>

          {/* Center: Desktop Navigation Links */}
          <motion.nav
            layout
            transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "hidden md:flex items-center",
              scrolled ? "gap-4 lg:gap-6" : "gap-7 lg:gap-9"
            )}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {visibleNavLinks.map((link) => {
                const isActive = activeSection === link.href.replace("#", "");
                return (
                  <motion.a
                    layout
                    key={link.name}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    href={link.href}
                    onClick={(e) => handleScrollTo(e, link.href)}
                    className={cn(
                      "relative text-xs font-semibold tracking-[0.12em] uppercase transition-colors py-1 select-none whitespace-nowrap",
                      isActive
                        ? "text-primary dark:text-white font-bold"
                        : "text-primary-muted/70 hover:text-primary dark:text-[#888888] dark:hover:text-white"
                    )}
                  >
                    {link.name}
                  </motion.a>
                );
              })}
            </AnimatePresence>
          </motion.nav>

          {/* Right Controls Container */}
          <motion.div
            layout
            transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-2 sm:gap-3"
          >
            {/* Desktop Top State Controls: ThemeToggle, ⌘K, Resume (Hidden with smooth exit in Scrolled State) */}
            <AnimatePresence mode="popLayout" initial={false}>
              {!scrolled && (
                <motion.div
                  key="top-desktop-controls"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="hidden md:flex items-center gap-3 sm:gap-4"
                >
                  {/* Theme Toggle */}
                  <ThemeToggle />

                  {/* Command Palette Trigger */}
                  <button
                    onClick={onOpenTerminal}
                    title="Open Developer Command Palette (⌘K / Ctrl+K)"
                    aria-label="Open Developer Command Palette (⌘K / Ctrl+K)"
                    className="flex items-center gap-1.5 p-2 text-primary-muted hover:text-primary transition-colors text-xs font-mono"
                  >
                    <Terminal className="w-3.5 h-3.5 text-accent dark:text-[#E8FF70]" />
                    <span className="hidden lg:inline text-[11px] font-semibold tracking-wider text-primary-muted">
                      ⌘K
                    </span>
                  </button>

                  {/* Resume Link */}
                  <a
                    href={portfolioData.personal.resumeUrl}
                    download="Resume-Placeholder.pdf"
                    className="inline-flex items-center gap-1.5 p-2 text-xs font-semibold tracking-wider uppercase text-primary-muted hover:text-primary transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-accent dark:text-[#E8FF70]" />
                    <span>Resume</span>
                  </a>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Let's Talk CTA (Visible in BOTH Top & Scrolled States on Desktop; opens Contact Modal) */}
            <motion.button
              type="button"
              layout
              transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => {
                e.preventDefault();
                if (onOpenContact) {
                  onOpenContact();
                } else if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("open-contact-modal"));
                }
              }}
              className={cn(
                "hidden md:inline-flex items-center gap-1.5 rounded-full bg-accent hover:bg-accent-hover text-white dark:text-[#101110] font-mono font-bold text-xs tracking-wider uppercase transition-colors shadow-md shadow-accent/20 cursor-pointer",
                scrolled
                  ? "px-4 py-1.5 text-[11px]"
                  : "px-5 py-2 text-xs"
              )}
              aria-label="Open contact modal to start conversation"
            >
              <span>Let&apos;s Talk</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </motion.button>

            {/* Mobile Actions */}
            <div className="flex md:hidden items-center gap-2">
              {scrolled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    if (onOpenContact) {
                      onOpenContact();
                    } else if (typeof window !== "undefined") {
                      window.dispatchEvent(new CustomEvent("open-contact-modal"));
                    }
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-accent hover:bg-accent-hover text-white dark:text-[#101110] font-mono font-bold text-[11px] tracking-wider uppercase shadow-sm cursor-pointer"
                  aria-label="Open contact modal"
                >
                  <span>Talk</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              )}

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-1.5 sm:p-2 text-primary hover:text-accent transition-colors rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
              </button>
            </div>
          </motion.div>
        </motion.div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation drawer"
          className="fixed inset-0 z-40 md:hidden bg-background/98 backdrop-blur-2xl pt-24 px-6 flex flex-col justify-between pb-8 border-b border-border animate-in fade-in duration-200"
        >
          {/* Navigation Links (Without Philosophy) */}
          <div className="flex flex-col gap-1.5 overflow-y-auto">
            <span className="font-mono text-[10px] text-accent dark:text-[#E8FF70] uppercase tracking-widest mb-2 px-3">
              {"//"} DIRECTORY NAVIGATION
            </span>
            {navLinks.map((link) => {
              const isActive = activeSection === link.href.replace("#", "");
              return (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={(e) => handleScrollTo(e, link.href)}
                  className={cn(
                    "flex items-center justify-between p-3.5 rounded-xl text-sm font-semibold tracking-wider uppercase transition-all",
                    isActive
                      ? "bg-accent/10 text-accent dark:text-[#E8FF70] font-bold border border-accent/30"
                      : "text-primary hover:bg-surface border border-transparent"
                  )}
                >
                  <span>{link.name}</span>
                  <ArrowUpRight className="w-4 h-4 opacity-70" />
                </a>
              );
            })}
          </div>

          {/* Drawer Footer Actions */}
          <div className="pt-5 border-t border-border flex flex-col gap-3">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-mono font-semibold tracking-wider text-primary-muted uppercase">
                THEME PREFERENCE
              </span>
              <ThemeToggle />
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <a
                href={portfolioData.personal.resumeUrl}
                download="Resume-Placeholder.pdf"
                className="flex items-center justify-center gap-1.5 p-3 rounded-full bg-surface border border-border text-primary font-bold text-xs uppercase tracking-wider hover:border-accent transition-colors shadow-sm"
              >
                <FileText className="w-3.5 h-3.5 text-accent dark:text-[#E8FF70]" />
                <span>Resume</span>
              </a>

              <a
                href="#contact"
                onClick={(e) => handleScrollTo(e, "#contact")}
                className="flex items-center justify-center gap-1.5 p-3 rounded-full bg-accent hover:bg-accent-hover text-white dark:text-[#101110] font-bold text-xs uppercase tracking-wider shadow-md shadow-accent/20 transition-all"
              >
                <span>Let&apos;s Talk</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
