"use client";

import { useEffect, useState } from "react";
import { portfolioData } from "@/data/portfolioData";
import { ArrowUpRight, Github, Linkedin, Twitter, Mail, MapPin, CheckCircle2, QrCode } from "lucide-react";
import RainbowPhotoGallery from "@/components/RainbowPhotoGallery";
import CardSurfaceRgbDots from "@/components/CardSurfaceRgbDots";
import IdBarcode from "@/components/IdBarcode";
import ProfileCardMedia from "@/components/ProfileCardMedia";

export default function Hero() {
  const [timeString, setTimeString] = useState<string>("07:30 PM");
  const [cardMode, setCardMode] = useState<"id" | "upi">("id");
  const [isTransforming, setIsTransforming] = useState<boolean>(false);

  const handleToggleMode = () => {
    if (isTransforming) return;
    setIsTransforming(true);
    setCardMode((prev) => (prev === "id" ? "upi" : "id"));
  };

  const handleAnimationComplete = () => {
    setIsTransforming(false);
  };

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
      id="hero"
      className="relative flex flex-col justify-center pt-[110px] pb-12 sm:pt-28 sm:pb-14 lg:pt-36 lg:pb-20 border-b border-border bg-dot-grid overflow-hidden transition-colors"
    >
      {/* Cinematic ambient radial gradient */}
      <div className="pointer-events-none absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[500px] rounded-full bg-accent/[0.05] blur-[150px]" />
      <div className="pointer-events-none absolute top-1/2 right-1/4 w-[500px] h-[500px] rounded-full bg-accent/[0.04] blur-[140px]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-10 lg:gap-8 items-center">
          
          {/* Left Column: Headline & Intro */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            
            {/* Professional Editorial Descriptor (Clean typography, no pill, no border, no dot) */}
            <p className="animate-fade-in-up font-mono text-[11px] sm:text-xs md:text-sm font-semibold tracking-[0.14em] sm:tracking-[0.18em] uppercase text-primary-muted mb-[28px] sm:mb-5 lg:mb-6">
              {portfolioData.personal.role}
            </p>

            {/* Editorial Main Headline (Responsive fluid scale, natural mobile wrap, zero clipping, no underlines) */}
            <h1 className="animate-fade-in-up delay-100 text-[1.95rem] sm:text-5xl md:text-6xl lg:text-[5.2rem] font-extrabold tracking-[-0.035em] sm:tracking-[-0.04em] text-primary leading-[1.15] sm:leading-[1.04] lg:leading-[0.98] mb-[48px] sm:mb-8 lg:mb-10 text-balance">
              {portfolioData.personal.headlineLead} <br className="hidden sm:inline" />
              <span className="text-accent">
                {portfolioData.personal.headlineAccent}
              </span> <br className="hidden sm:inline" />
              <span className="whitespace-nowrap sm:whitespace-normal">
                {portfolioData.personal.headlineEnd}
              </span>
            </h1>

            {/* CTA Buttons & Social Links Row */}
            <div className="animate-fade-in-up delay-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-[24px] sm:gap-3.5 w-full sm:w-auto">
              
              {/* Responsive Side-by-Side CTAs */}
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 sm:gap-3.5 w-full sm:w-auto">
                {/* Primary CTA */}
                <a
                  href="#work"
                  onClick={(e) => handleScrollTo(e, "#work")}
                  className="group inline-flex items-center justify-center gap-1.5 sm:gap-2 px-4 sm:px-7 py-2.5 sm:py-3.5 rounded-full bg-accent hover:bg-accent-hover text-white dark:text-[#101110] font-bold text-[11px] sm:text-xs tracking-wider uppercase transition-all duration-200 shadow-md sm:shadow-xl shadow-accent/20 whitespace-nowrap text-center"
                >
                  <span>View My Work</span>
                  <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>

                {/* Secondary CTA */}
                <a
                  href="#contact"
                  onClick={(e) => handleScrollTo(e, "#contact")}
                  className="inline-flex items-center justify-center gap-1.5 px-4 sm:px-7 py-2.5 sm:py-3.5 rounded-full bg-surface hover:bg-surface-elevated border border-border hover:border-accent text-primary font-semibold text-[11px] sm:text-xs tracking-wider uppercase transition-all duration-200 shadow-sm whitespace-nowrap text-center"
                >
                  <span>Say Hello</span>
                </a>
              </div>

              {/* Social Icon Links (Compact 40px touch-friendly circles) */}
              <div className="flex items-center justify-start gap-2.5 sm:gap-2 sm:ml-2">
                <a
                  href={portfolioData.personal.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-full bg-surface border border-border hover:border-accent text-primary-muted hover:text-accent hover:scale-105 active:scale-95 transition-all duration-200 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer"
                  aria-label="GitHub Profile"
                >
                  <Github className="w-4 h-4" />
                </a>
                <a
                  href={portfolioData.personal.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-full bg-surface border border-border hover:border-accent text-primary-muted hover:text-accent hover:scale-105 active:scale-95 transition-all duration-200 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer"
                  aria-label="LinkedIn Profile"
                >
                  <Linkedin className="w-4 h-4" />
                </a>
                <a
                  href={portfolioData.personal.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-full bg-surface border border-border hover:border-accent text-primary-muted hover:text-accent hover:scale-105 active:scale-95 transition-all duration-200 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer"
                  aria-label="X Profile"
                >
                  <Twitter className="w-4 h-4" />
                </a>
                <a
                  href={`mailto:${portfolioData.personal.email}`}
                  className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-full bg-surface border border-border hover:border-accent text-primary-muted hover:text-accent hover:scale-105 active:scale-95 transition-all duration-200 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer"
                  aria-label="Send Email"
                >
                  <Mail className="w-4 h-4" />
                </a>
              </div>

            </div>

          </div>

          {/* Right Column: Digital Developer ID Badge Card / Titanium Device */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end mt-3 sm:mt-10 lg:mt-0 w-full">
            <div className="animate-fade-in-up delay-200 relative w-full max-w-full sm:max-w-[390px] rounded-[28px] sm:rounded-[32px] bg-surface border border-border p-4 sm:p-5 shadow-xl hover:border-accent/40 transition-all duration-300 group">
              
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
    </section>
  );
}
