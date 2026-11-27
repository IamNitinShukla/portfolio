"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, ArrowUpRight, RotateCw, AlertCircle } from "lucide-react";
import { portfolioData } from "@/data/portfolioData";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BookingModal({ isOpen, onClose }: BookingModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Source of truth for Cal.com booking link
  const rawCalUrl =
    process.env.NEXT_PUBLIC_CAL_LINK ||
    portfolioData.personal.calDotCom ||
    "https://cal.com/nitinshukla/30min";

  // Normalize link slug (e.g., "nitinshukla/30min")
  const calLink = rawCalUrl.replace(/^https?:\/\/cal\.com\//, "").replace(/\/+$/, "");

  // Prevent background scrolling and attach ESC listener when modal is open
  useEffect(() => {
    if (!isOpen) {
      setIsLoading(true);
      setHasError(false);
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Load Cal.com embed snippet if available
  useEffect(() => {
    if (!isOpen) return;

    try {
      (function (C: any, A: string, L: string) {
        let p = function (a: any, ar: any) {
          a.q.push(ar);
        };
        let d = C.document;
        C.Cal =
          C.Cal ||
          function () {
            let cal = C.Cal;
            let ar = arguments;
            if (!cal.loaded) {
              cal.ns = {};
              cal.q = cal.q || [];
              const script = d.createElement("script");
              script.src = A;
              d.head.appendChild(script);
              cal.loaded = true;
            }
            if (ar[0] === L) {
              const api: any = function () {
                p(api, arguments);
              };
              const namespace = ar[1];
              api.q = api.q || [];
              if (typeof namespace === "string") {
                cal.ns[namespace] = cal.ns[namespace] || api;
                p(cal.ns[namespace], ar);
                p(cal, ["initNamespace", namespace]);
              } else p(cal, ar);
              return;
            }
            p(cal, ar);
          };
      })(window, "https://app.cal.com/embed/embed.js", "init");

      if (typeof (window as any).Cal === "function") {
        (window as any).Cal("init", { origin: "https://cal.com" });
        (window as any).Cal("ui", {
          theme: "dark",
          styles: {
            branding: { brandColor: "#E8FF70" },
          },
          hideEventTypeDetails: false,
          layout: "month_view",
        });
      }
    } catch {
      // Safe fallback if snippet injection is blocked
    }
  }, [isOpen]);

  const embedUrl = `https://cal.com/${calLink}?embed=true&theme=dark&brandColor=%23E8FF70&layout=month_view`;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-modal-title"
          className="fixed inset-0 z-[100] flex items-center justify-center p-2.5 sm:p-4 md:p-6"
        >
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/85 backdrop-blur-md cursor-pointer -z-10"
            aria-hidden="true"
          />

          {/* Modal Container */}
          <motion.div
            ref={containerRef}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-5xl h-[94vh] sm:h-[88vh] max-h-[860px] bg-[#0c0d0c] border border-white/[0.09] rounded-2xl sm:rounded-3xl shadow-2xl shadow-black/80 flex flex-col overflow-hidden text-white"
          >
            {/* Header: Compact animated red robot mascot + Let's Talk heading + Subtitle + Close */}
            <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 bg-[#121312] border-b border-white/[0.08]">
              {/* Mascot & Title Group */}
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                {/* Animated Red Robot Mascot */}
                <div
                  className="relative w-11 h-11 sm:w-13 sm:h-13 rounded-xl sm:rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center overflow-hidden shrink-0 shadow-inner group"
                  title="Nitin's AI companion"
                >
                  <video
                    src="/mascot/animations/idle.webm"
                    autoPlay
                    loop
                    muted
                    playsInline
                    aria-hidden="true"
                    className="w-full h-full object-contain pointer-events-none select-none scale-110"
                  />
                  {/* Subtle status dot */}
                  <span
                    className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-accent dark:bg-[#E8FF70] ring-2 ring-[#121312] animate-pulse"
                    aria-hidden="true"
                  />
                </div>

                {/* Headings */}
                <div className="min-w-0 flex flex-col">
                  <div className="flex items-center gap-2">
                    <h2
                      id="booking-modal-title"
                      className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap"
                    >
                      Let&apos;s Talk
                    </h2>
                    <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold tracking-wider uppercase bg-accent/10 dark:bg-[#E8FF70]/10 text-accent dark:text-[#E8FF70] border border-accent/20 dark:border-[#E8FF70]/20">
                      30-Min Sync
                    </span>
                  </div>
                  <p className="text-xs text-[#8e8e8e] truncate mt-0.5">
                    Choose a time that works for you.
                  </p>
                </div>
              </div>

              {/* Actions: Direct link & Accessible Close button */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <a
                  href={`https://cal.com/${calLink}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-xs text-[#9e9e9e] hover:text-white transition-colors border border-white/[0.06]"
                  title="Open booking in full window"
                  aria-label="Open booking page in full window"
                >
                  <span className="text-[11px] font-mono">cal.com</span>
                  <ArrowUpRight className="w-3 h-3" />
                </a>

                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 sm:p-2.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-[#9e9e9e] hover:text-white transition-colors border border-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label="Close booking modal"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content: Cal.com Official Embed */}
            <div className="relative flex-1 w-full h-full min-h-0 bg-[#0a0a0a] overflow-hidden">
              {/* Loading State Skeleton */}
              {isLoading && !hasError && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a] z-10 p-6 text-center"
                  aria-live="polite"
                  aria-busy="true"
                >
                  <div className="relative flex items-center justify-center mb-4">
                    <div className="w-10 h-10 border-2 border-accent/20 dark:border-[#E8FF70]/20 border-t-accent dark:border-t-[#E8FF70] rounded-full animate-spin" />
                    <Calendar className="w-4 h-4 text-accent dark:text-[#E8FF70] absolute" />
                  </div>
                  <p className="text-xs sm:text-sm font-mono text-[#8e8e8e] tracking-wide">
                    Loading live availability from Cal.com...
                  </p>
                </div>
              )}

              {/* Error State Fallback */}
              {hasError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a] z-10 p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4">
                    <AlertCircle className="w-6 h-6 text-rose-400" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white mb-1">
                    Unable to load calendar embed
                  </h3>
                  <p className="text-xs text-[#8e8e8e] max-w-sm mb-5">
                    Your browser or network blocked the embed script. You can still schedule
                    directly on Cal.com:
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setHasError(false);
                        setIsLoading(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-xs font-mono font-semibold text-white border border-white/10 transition-colors"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Retry</span>
                    </button>
                    <a
                      href={`https://cal.com/${calLink}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-accent hover:bg-accent-hover text-[#101110] font-mono font-bold text-xs tracking-wider uppercase transition-colors shadow-md shadow-accent/20"
                    >
                      <span>Open Cal.com</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}

              {/* Supported Cal.com Inline Embed Iframe */}
              <iframe
                id="cal-booking-iframe"
                src={embedUrl}
                allow="camera; microphone; autoplay; fullscreen"
                title="Schedule a 30-minute meeting with Nitin Shukla"
                className="w-full h-full border-0 rounded-b-2xl sm:rounded-b-3xl bg-[#0a0a0a]"
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setHasError(true);
                }}
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
