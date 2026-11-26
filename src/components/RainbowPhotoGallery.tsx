"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { portfolioData, ProfileImage } from "@/data/portfolioData";

interface RainbowPhotoGalleryProps {
  images?: ProfileImage[];
}

export default function RainbowPhotoGallery({
  images = portfolioData.personal.profileImages,
}: RainbowPhotoGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isFanned, setIsFanned] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<NodeJS.Timeout | null>(null);
  const prefersReduced = useReducedMotion();

  // Pointer / Touch tracking references
  const isPointerDown = useRef(false);
  const wasAlreadyFannedOnDown = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const hasDragged = useRef(false);

  const total = images.length;

  // Responsive mobile check for calibrated arc translation values
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(typeof window !== "undefined" && window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Preload all 4 genuine photographs on mount for zero-latency instant transitions
  useEffect(() => {
    if (typeof window === "undefined" || !images.length) return;
    images.forEach((img) => {
      const el = new window.Image();
      el.src = img.src;
    });
  }, [images]);

  // Clean up any hover timer on unmount
  useEffect(() => {
    return () => {
      if (leaveTimer.current) {
        clearTimeout(leaveTimer.current);
      }
    };
  }, []);

  // Sync focusedIndex when activeIndex changes or gallery opens
  const openFan = useCallback(
    (targetIndex?: number) => {
      if (leaveTimer.current) {
        clearTimeout(leaveTimer.current);
        leaveTimer.current = null;
      }
      setIsFanned(true);
      setFocusedIndex(targetIndex !== undefined ? targetIndex : activeIndex);
    },
    [activeIndex]
  );

  const closeFan = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
    }
    leaveTimer.current = setTimeout(() => {
      setIsFanned(false);
      setFocusedIndex(activeIndex);
    }, 250);
  }, [activeIndex]);

  // Handle slide selection & commitment
  const commitPhoto = useCallback((index: number) => {
    setActiveIndex(index);
    setFocusedIndex(index);
  }, []);

  // Mouse hover event handlers for desktop
  const handleMouseEnter = () => {
    openFan();
  };

  const handleMouseLeave = () => {
    closeFan();
  };

  // Close fan if user taps outside on touch screens
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsFanned(false);
        setFocusedIndex(activeIndex);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [activeIndex]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = (activeIndex - 1 + total) % total;
      commitPhoto(prev);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = (activeIndex + 1) % total;
      commitPhoto(next);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsFanned((prev) => !prev);
    }
  };

  // Helper to resolve which photograph index corresponds to a touch/drag point
  const resolveIndexAtPoint = (clientX: number, clientY: number): number | null => {
    if (typeof document === "undefined") return null;

    // 1. First probe via elementFromPoint
    const target = document.elementFromPoint(clientX, clientY);
    if (target) {
      const cardEl = target.closest("[data-photo-index]");
      if (cardEl) {
        const idx = Number(cardEl.getAttribute("data-photo-index"));
        if (!isNaN(idx) && idx >= 0 && idx < total) {
          return idx;
        }
      }
    }

    // 2. Fallback: Horizontal band mapping relative to gallery container
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const relX = (clientX - rect.left) / rect.width;

      // Ordered visual slots from left to right relative to current focusedIndex:
      // slotFarLeft (diff=2) -> slotNearLeft (diff=3) -> slotCenter (diff=0) -> slotRight (diff=1)
      const slotFarLeft = (focusedIndex + 2) % total;
      const slotNearLeft = (focusedIndex + 3) % total;
      const slotCenter = focusedIndex;
      const slotRight = (focusedIndex + 1) % total;

      if (relX < 0.22) return slotFarLeft;
      if (relX < 0.44) return slotNearLeft;
      if (relX < 0.72) return slotCenter;
      return slotRight;
    }

    return null;
  };

  // Pointer event handlers (Handles both mouse and touch gestures seamlessly)
  const handlePointerDown = (e: React.PointerEvent) => {
    isPointerDown.current = true;
    startX.current = e.clientX;
    startY.current = e.clientY;
    hasDragged.current = false;
    wasAlreadyFannedOnDown.current = isFanned;

    // On touch or click, if fan is not yet open, open it immediately
    if (!isFanned) {
      openFan();
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPointerDown.current) {
      const dx = e.clientX - startX.current;
      const dy = e.clientY - startY.current;

      // Detect intentional horizontal drag
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 0.8) {
        hasDragged.current = true;
        const candidate = resolveIndexAtPoint(e.clientX, e.clientY);
        if (candidate !== null && candidate !== focusedIndex) {
          setFocusedIndex(candidate);
        }
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isPointerDown.current) return;
    isPointerDown.current = false;

    if (hasDragged.current) {
      // Drag completed: commit focused photo as the selected active photo
      commitPhoto(focusedIndex);
    } else {
      // Tap without drag:
      if (wasAlreadyFannedOnDown.current) {
        // If already fanned, tapping toggles or commits selection
        const candidate = resolveIndexAtPoint(e.clientX, e.clientY);
        if (candidate !== null) {
          commitPhoto(candidate);
        }
        setIsFanned(false);
      }
    }
    hasDragged.current = false;
  };

  const handlePointerCancel = () => {
    isPointerDown.current = false;
    hasDragged.current = false;
  };

  // Calculate fan slot transformation for each photograph
  // Mathematical arc ensures center is dominant and side photographs do NOT droop downward
  const getFanTransform = (index: number) => {
    if (!isFanned || prefersReduced) {
      if (index === activeIndex) {
        return {
          x: 0,
          y: 0,
          rotate: 0,
          scale: 1,
          opacity: 1,
          zIndex: 20,
        };
      }
      return {
        x: 0,
        y: 0,
        rotate: 0,
        scale: 0.96,
        opacity: 0,
        zIndex: 0,
      };
    }

    // Relative circular difference from currently focused index (0 to 3)
    const diff = (index - focusedIndex + total) % total;

    // Arc geometry mapping:
    // diff === 0: Center Apex (Dominant, largest, closest to viewer)
    // diff === 1: Right Card (Visibly protruding outside right card border)
    // diff === 2: Far Left Card (Visibly protruding furthest outside left card border)
    // diff === 3: Near Left Card (Visibly protruding left between center & far left)
    let x = 0;
    let y = 0;
    let rotate = 0;
    let scale = isMobile ? 0.89 : 0.91;
    let zIndex = 15;

    if (diff === 0) {
      // Active Centred Image — Largest, apex elevation, perfectly upright
      x = 0;
      y = isMobile ? -8 : -12;
      rotate = 0;
      scale = isMobile ? 1.0 : 1.02;
      zIndex = 40;
    } else if (diff === 1) {
      // Right side card (protrudes right beyond outer card border)
      x = isMobile ? 22 : 92;
      y = isMobile ? -4 : -6;
      rotate = isMobile ? 6 : 8.5;
      scale = isMobile ? 0.89 : 0.91;
      zIndex = 25;
    } else if (diff === 2) {
      // Far Left card (protrudes furthest left into open hero space)
      x = isMobile ? -30 : -135;
      y = isMobile ? -1 : -2;
      rotate = isMobile ? -9 : -12.5;
      scale = isMobile ? 0.86 : 0.87;
      zIndex = 15;
    } else if (diff === 3) {
      // Near Left card (protrudes left between center and far left)
      x = isMobile ? -16 : -72;
      y = isMobile ? -4 : -6;
      rotate = isMobile ? -5 : -7;
      scale = isMobile ? 0.9 : 0.92;
      zIndex = 25;
    }

    return {
      x,
      y,
      rotate,
      scale,
      opacity: 1,
      zIndex,
    };
  };

  return (
    <div
      ref={containerRef}
      role="region"
      aria-roledescription="carousel"
      aria-label="Nitin Shukla Photograph Gallery"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className="relative mt-3 sm:mt-4 aspect-[4/4.7] select-none touch-pan-y cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {/* Base photo aperture / backing frame */}
      <div className="absolute inset-0 rounded-xl sm:rounded-2xl border border-border bg-surface-secondary/80 pointer-events-none" />

      {/* Invisible hover zone padding when fanned so mouse can move freely between cards without collapsing */}
      {isFanned && (
        <div
          className="absolute -inset-x-32 -inset-y-12 z-0 pointer-events-auto"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
      )}

      {/* 4 Layered Floating Photographs in Dynamic Centre-Focus Fan Structure */}
      {images.map((img, idx) => {
        const isCenter = idx === focusedIndex;
        const transform = getFanTransform(idx);

        return (
          <motion.div
            key={img.src}
            data-photo-index={idx}
            animate={transform}
            transition={
              prefersReduced
                ? { duration: 0.3 }
                : {
                    type: "spring",
                    stiffness: 95,
                    damping: 17,
                    mass: 0.85,
                    opacity: { duration: 0.45, ease: "easeInOut" },
                  }
            }
            onPointerEnter={(e) => {
              // On desktop hover, dynamically move hovered photograph to centre position
              if (e.pointerType === "mouse" && isFanned && idx !== focusedIndex) {
                setFocusedIndex(idx);
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              commitPhoto(idx);
            }}
            className={`absolute inset-0 w-full h-full rounded-xl sm:rounded-2xl overflow-hidden transition-shadow duration-500 ${
              isCenter
                ? "shadow-2xl border border-white/25 dark:border-white/15"
                : isFanned
                ? "shadow-xl border border-white/20 dark:border-white/10"
                : ""
            }`}
            style={{
              transformOrigin: "50% 88%",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
          >
            <Image
              src={img.src}
              alt={img.alt}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 390px"
              priority={idx === 0}
              unoptimized
              className="object-cover object-center w-full h-full pointer-events-none select-none"
            />

            {/* Depth vignette on background side cards when fan is active */}
            {isFanned && !isCenter && (
              <div className="absolute inset-0 bg-black/15 dark:bg-black/25 pointer-events-none transition-colors duration-400" />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
