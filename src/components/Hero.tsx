"use client";

import { useEffect, useState, useRef } from "react";
import { portfolioData } from "@/data/portfolioData";
import { ArrowUpRight, Github, Linkedin, Twitter, MapPin, CheckCircle2, QrCode } from "lucide-react";
import RainbowPhotoGallery from "@/components/RainbowPhotoGallery";
import CardSurfaceRgbDots from "@/components/CardSurfaceRgbDots";
import IdBarcode from "@/components/IdBarcode";
import ProfileCardMedia from "@/components/ProfileCardMedia";

interface HeroProps {
  onOpenContact?: () => void;
}

export default function Hero({ onOpenContact }: HeroProps = {}) {
  const [timeString, setTimeString] = useState<string>("07:30 PM");
  const [cardMode, setCardMode] = useState<"id" | "upi">("id");
  const [isTransforming, setIsTransforming] = useState<boolean>(false);

  const heroRef = useRef<HTMLElement | null>(null);
  const spotlightMaskRef = useRef<HTMLDivElement | null>(null);
  const ambientMaskRef = useRef<HTMLDivElement | null>(null);

  const handleToggleMode = () => {
    if (isTransforming) return;
    setIsTransforming(true);
    setCardMode((prev) => (prev === "id" ? "upi" : "id"));
  };

  const handleAnimationComplete = () => {
    setIsTransforming(false);
  };

  // Interactive Dot Background: Dual ambient spotlights (desktop initial & idle) + Cursor-following spotlight + Mobile stationary spotlight
  useEffect(() => {
    const maskEl = spotlightMaskRef.current;
    const ambientEl = ambientMaskRef.current;
    if (!maskEl || !ambientEl) return;

    let rafId: number;
    let isDesktopMode = false;
    let targetX = -9999;
    let targetY = -9999;
    let currentX = -9999;
    let currentY = -9999;
    let isMoving = false;
    let idleTimer: NodeJS.Timeout | null = null;

    const setAmbientActive = (active: boolean) => {
      if (ambientEl) {
        ambientEl.style.opacity = active ? "1" : "0";
      }
      if (maskEl) {
        maskEl.style.opacity = active ? "0" : "1";
      }
    };

    const applyMode = () => {
      const isFinePointer = window.matchMedia("(pointer: fine)").matches;
      const isMobileWidth = window.innerWidth < 768;
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (!isFinePointer || isMobileWidth || prefersReducedMotion) {
        isDesktopMode = false;
        // Mobile / Touchscreen: Soft stationary spotlight positioned toward the RIGHT side of the viewport
        ambientEl.style.opacity = "0";
        const mobileGradient =
          "radial-gradient(380px circle at 82% 38%, black 0%, rgba(0, 0, 0, 0.45) 45%, transparent 75%)";
        maskEl.style.maskImage = mobileGradient;
        maskEl.style.webkitMaskImage = mobileGradient;
        maskEl.style.opacity = "0.9";
      } else {
        isDesktopMode = true;
        // Desktop default before pointer movement: dual ambient lights active
        maskEl.style.maskImage = "";
        maskEl.style.webkitMaskImage = "";
        setAmbientActive(true);
      }
    };

    applyMode();
    window.addEventListener("resize", applyMode);

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDesktopMode) return;
      const hero = heroRef.current;
      if (!hero) return;
      const rect = hero.getBoundingClientRect();
      targetX = e.clientX - rect.left;
      targetY = e.clientY - rect.top;

      if (!isMoving) {
        isMoving = true;
        currentX = targetX;
        currentY = targetY;
        setAmbientActive(false);
      }

      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (isDesktopMode) {
          isMoving = false;
          setAmbientActive(true);
        }
      }, 2000);
    };

    const handlePointerLeave = () => {
      if (!isDesktopMode) return;
      if (idleTimer) clearTimeout(idleTimer);
      isMoving = false;
      setAmbientActive(true);
    };

    const hero = heroRef.current;
    if (hero) {
      hero.addEventListener("pointermove", handlePointerMove, { passive: true });
      hero.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    }

    const render = () => {
      if (isDesktopMode && isMoving && currentX > -5000) {
        currentX += (targetX - currentX) * 0.15;
        currentY += (targetY - currentY) * 0.15;

        const roundX = Math.round(currentX);
        const roundY = Math.round(currentY);
        const maskGradient = `radial-gradient(360px circle at ${roundX}px ${roundY}px, black 0%, rgba(0, 0, 0, 0.5) 45%, transparent 75%)`;

        maskEl.style.maskImage = maskGradient;
        maskEl.style.webkitMaskImage = maskGradient;
      }
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      if (idleTimer) clearTimeout(idleTimer);
      window.removeEventListener("resize", applyMode);
      if (hero) {
        hero.removeEventListener("pointermove", handlePointerMove);
        hero.removeEventListener("pointerleave", handlePointerLeave);
      }
    };
  }, []);

  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date();
        const istTime = now.toLocaleTimeString("en-US", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
        setTimeString(istTime);
      } catch {
        setTimeString("07:30 PM");
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleScrollTo = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section
      ref={heroRef}
      id="hero"
      className="relative flex flex-col justify-center pt-[110px] pb-12 sm:pt-28 sm:pb-14 lg:pt-36 lg:pb-20 border-b border-border overflow-hidden transition-colors"
    >
      {/* 1. Default Ambient Dual-Spotlight Layer (Upper-Left + Lower-Right softly illuminating background dots before movement or when idle) */}
      <div
        ref={ambientMaskRef}
        className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-700 ease-out opacity-100"
        aria-hidden="true"
        style={{
          maskImage:
            "radial-gradient(420px circle at 18% 22%, black 0%, rgba(0, 0, 0, 0.45) 40%, transparent 72%), radial-gradient(480px circle at 82% 70%, black 0%, rgba(0, 0, 0, 0.45) 40%, transparent 72%)",
          WebkitMaskImage:
            "radial-gradient(420px circle at 18% 22%, black 0%, rgba(0, 0, 0, 0.45) 40%, transparent 72%), radial-gradient(480px circle at 82% 70%, black 0%, rgba(0, 0, 0, 0.45) 40%, transparent 72%)",
        }}
      >
        <div className="absolute inset-0 bg-dot-grid-bright" />
        <div className="absolute inset-0 bg-accent/[0.035] dark:bg-accent/[0.04]" />
      </div>

      {/* 2. Interactive Cursor Spotlight Layer: Dots appear strictly inside the cursor spotlight on desktop, and stationary right-side spotlight on mobile */}
      <div
        ref={spotlightMaskRef}
        className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-500 ease-out opacity-0"
        aria-hidden="true"
      >
        {/* Dots revealed strictly by the spotlight mask */}
        <div className="absolute inset-0 bg-dot-grid-bright" />
        {/* Soft, diffuse ambient radial illumination that smoothly accompanies the spotlight */}
        <div className="absolute inset-0 bg-accent/[0.04] dark:bg-accent/[0.045]" />
      </div>

      {/* 3. Cinematic ambient radial gradient accents */}
      <div className="pointer-events-none absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[500px] rounded-full bg-accent/[0.035] blur-[150px]" />
      <div className="pointer-events-none absolute top-1/2 right-1/4 w-[500px] h-[500px] rounded-full bg-accent/[0.03] blur-[140px]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-10 lg:gap-8 items-center">
          
          {/* Left Column: Headline & Intro */}
          <div className="lg:col-span-7 flex flex-col items-start text-left w-full">
            
            {/* Professional Editorial Descriptor (Clean typography, no pill, no border, no dot) */}
            <p className="animate-fade-in-up font-mono text-[11px] sm:text-xs md:text-sm font-semibold tracking-[0.14em] sm:tracking-[0.18em] uppercase text-primary-muted mb-5 sm:mb-5 lg:mb-6">
              {portfolioData.personal.role}
            </p>

            {/* Editorial Main Headline (Responsive fluid scale, spacious mobile leading, natural wrap, zero clipping) */}
            <h1 className="animate-fade-in-up delay-100 text-[clamp(2rem,8.2vw,2.65rem)] sm:text-5xl md:text-6xl lg:text-[5.2rem] font-extrabold tracking-tight sm:tracking-[-0.04em] text-primary leading-[1.20] sm:leading-[1.04] lg:leading-[0.98] mb-6 sm:mb-8 lg:mb-10 w-full break-words">
              {portfolioData.personal.headlineLead}{" "}
              <br className="hidden sm:inline" />
              <span className="text-accent">
                {portfolioData.personal.headlineAccent}
              </span>{" "}
              <br className="hidden sm:inline" />
              <span>
                {portfolioData.personal.headlineEnd}
              </span>
            </h1>

            {/* CTA Buttons & Social Links Row */}
            <div className="animate-fade-in-up delay-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-5 sm:gap-3.5 w-full sm:w-auto">
              
              {/* Responsive Side-by-Side CTAs (Classy, deliberate button widths, no awkward row stretching) */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-3.5 w-auto">
                {/* Primary CTA: View My Work */}
                <a
                  href="#work"
                  onClick={(e) => handleScrollTo(e, "#work")}
                  className="group inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-full bg-accent hover:bg-accent-hover text-white dark:text-[#101110] font-bold text-xs sm:text-[13px] tracking-wider uppercase transition-all duration-200 shadow-md sm:shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap text-center"
                >
                  <span>View My Work</span>
                  <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>

                {/* Secondary CTA: Say Hello (Transparent, subtle elegant outline, white text, opens contact modal) */}
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
                  className="inline-flex items-center justify-center px-5 sm:px-6 py-2.5 sm:py-3 rounded-full bg-transparent hover:bg-white/[0.05] dark:hover:bg-white/[0.06] border border-neutral-300 dark:border-white/20 hover:border-neutral-500 dark:hover:border-white/40 text-primary dark:text-white font-semibold text-xs sm:text-[13px] tracking-wider uppercase transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap text-center cursor-pointer"
                  aria-label="Open contact modal to say hello"
                >
                  <span>Say Hello</span>
                </button>
              </div>

              {/* Social Icon Links (Exactly 3 transparent icons: GitHub, LinkedIn, X; Mail removed) */}
              <div className="flex items-center justify-start gap-2.5 sm:gap-2.5 sm:ml-2">
                <a
                  href={portfolioData.personal.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-[42px] h-[42px] sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-transparent border border-neutral-300/80 dark:border-white/15 hover:border-accent dark:hover:border-accent text-neutral-500 dark:text-[#888888] hover:text-accent dark:hover:text-accent hover:scale-105 active:scale-95 transition-all duration-200 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer"
                  aria-label="GitHub Profile"
                >
                  <Github className="w-[18px] h-[18px] sm:w-4 sm:h-4" />
                </a>
                <a
                  href={portfolioData.personal.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-[42px] h-[42px] sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-transparent border border-neutral-300/80 dark:border-white/15 hover:border-accent dark:hover:border-accent text-neutral-500 dark:text-[#888888] hover:text-accent dark:hover:text-accent hover:scale-105 active:scale-95 transition-all duration-200 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer"
                  aria-label="LinkedIn Profile"
                >
                  <Linkedin className="w-[18px] h-[18px] sm:w-4 sm:h-4" />
                </a>
                <a
                  href={portfolioData.personal.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-[42px] h-[42px] sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-transparent border border-neutral-300/80 dark:border-white/15 hover:border-accent dark:hover:border-accent text-neutral-500 dark:text-[#888888] hover:text-accent dark:hover:text-accent hover:scale-105 active:scale-95 transition-all duration-200 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer"
                  aria-label="X Profile"
                >
                  <Twitter className="w-[18px] h-[18px] sm:w-4 sm:h-4" />
                </a>
              </div>

            </div>

          </div>

          {/* Right Column: Digital Developer ID Badge Card / Titanium Device */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end mt-3 sm:mt-10 lg:mt-0 w-full">
            <div className="animate-fade-in-up delay-200 relative w-full max-w-full sm:max-w-[390px] group">
              {/* Extremely subtle ambient lighting spread around the card edges */}
              <div
                className="pointer-events-none absolute -inset-1 sm:-inset-1.5 rounded-[34px] sm:rounded-[38px] bg-accent/[0.045] dark:bg-accent/[0.04] blur-2xl opacity-75 group-hover:opacity-100 transition-opacity duration-700 -z-10"
                aria-hidden="true"
              />

              <div className="relative w-full rounded-[28px] sm:rounded-[32px] bg-surface border border-border p-4 sm:p-5 shadow-xl hover:border-accent/40 transition-all duration-300">
                {/* Subtle RGB Digital Surface Dots (Restricted strictly to outer card surface; NEVER over photograph) */}
                <CardSurfaceRgbDots isUpiMode={cardMode === "upi"} isTransforming={isTransforming} />

                {/* Card Foreground Content Layer */}
                <div className="relative z-10 flex flex-col">
                {/* Speaker notch at top */}
                <div className="h-1 w-10 bg-border rounded-full mx-auto mb-3 sm:mb-3.5" />

                {/* Card Header Status Row */}
                <div className="flex items-center justify-between pb-3 sm:pb-3.5 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${cardMode === "upi" ? "bg-emerald-400" : "bg-accent"} animate-pulse`} />
                    <span className="font-mono text-[10px] sm:text-[11px] font-bold tracking-widest text-primary-muted uppercase">
                      {cardMode === "upi" ? "UPI // SCAN & PAY" : portfolioData.personal.devId}
                    </span>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border transition-colors ${
                      cardMode === "upi"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                        : "bg-accent/10 border-accent/30 text-accent"
                    }`}
                  >
                    {cardMode === "upi" ? (
                      <>
                        <QrCode className="w-3 h-3" />
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider">
                          ACTIVE QR
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider">
                          VERIFIED
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Interactive Profile Media Container: Mode A (Gallery) vs Mode B (UPI QR) with Particle Convergence */}
                <ProfileCardMedia
                  cardMode={cardMode}
                  isTransforming={isTransforming}
                  onAnimationComplete={handleAnimationComplete}
                  onToggle={handleToggleMode}
                  upiId={portfolioData.personal.upiId}
                  upiUri={portfolioData.personal.upiUri}
                />

                {/* Card Footer Metadata */}
                <div className="mt-3.5 sm:mt-4 pt-3 sm:pt-3.5 border-t border-border flex flex-col gap-2 sm:gap-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-[9px] sm:text-[10px] uppercase tracking-wider text-primary-muted">NAME // ROLE</p>
                      {cardMode === "upi" ? (
                        <button
                          type="button"
                          onClick={handleToggleMode}
                          className="font-bold text-sm sm:text-base text-primary hover:text-accent transition-colors flex items-center gap-1.5 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded -ml-0.5 px-0.5 group/nameReturn"
                          aria-label="Return to Personal Identity Mode"
                          title="Click to return to Identity Card"
                        >
                          <span>{portfolioData.personal.name}</span>
                          <span className="text-[10px] text-accent font-mono font-normal opacity-70 group-hover/nameReturn:opacity-100 transition-opacity">
                            ↩
                          </span>
                        </button>
                      ) : (
                        <p className="font-bold text-sm sm:text-base text-primary select-none">
                          {portfolioData.personal.name}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-[9px] sm:text-[10px] uppercase tracking-wider text-primary-muted">ORIGIN</p>
                      <p className="flex items-center gap-1 text-xs text-primary font-mono justify-end">
                        <MapPin className="w-3 h-3 text-accent" />
                        {portfolioData.personal.origin}
                      </p>
                    </div>
                  </div>

                  {/* Authentic Identification Barcode & Live Timestamp */}
                  <div className="pt-2 flex items-center justify-between font-mono text-[9px] sm:text-[10px] text-primary-subtle border-t border-border/70">
                    {/* Barcode Toggle Trigger */}
                    <button
                      type="button"
                      onClick={handleToggleMode}
                      className="flex items-center p-1 -m-1 rounded hover:bg-accent/10 transition-colors cursor-pointer group/barcode focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                      aria-label={cardMode === "upi" ? "Switch to Personal Identity Mode" : "Transform to UPI Payment Card"}
                      title={cardMode === "upi" ? "Click barcode to return to Identity Card" : "Click barcode to transform to UPI Payment Card"}
                    >
                      <IdBarcode code={portfolioData.personal.code} />
                    </button>
                    <div className="text-accent font-mono text-[10px] sm:text-[11px] font-semibold">
                      {portfolioData.personal.code} · {timeString}
                    </div>
                  </div>
                </div>
              </div>

              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
