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
  const [dragOffset, setDragOffset] = useState(0);
  const [slideDirection, setSlideDirection] = useState<"left" | "right" | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<NodeJS.Timeout | null>(null);
  const prevActiveIndexRef = useRef(0);
  const prefersReduced = useReducedMotion();

  // Desktop Pointer tracking references
  const isPointerDown = useRef(false);
  const wasAlreadyFannedOnDown = useRef(false);
  const pointerStartX = useRef(0);
  const pointerStartY = useRef(0);
  const hasDragged = useRef(false);

  // Mobile Touch swipe tracking references
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isSwipingRef = useRef(false);
  const isVerticalScrollRef = useRef(false);

  const total = images.length;

  // Responsive mobile check
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(typeof window !== "undefined" && window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Preload all genuine photographs on mount for zero-latency instant transitions
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

  // Sync focusedIndex when activeIndex changes or gallery opens (desktop)
  const openFan = useCallback(
    (targetIndex?: number) => {
      const mobile = typeof window !== "undefined" ? window.innerWidth < 640 : isMobile;
      if (mobile) return;
      if (leaveTimer.current) {
        clearTimeout(leaveTimer.current);
        leaveTimer.current = null;
      }
      setIsFanned(true);
      setFocusedIndex(targetIndex !== undefined ? targetIndex : activeIndex);
    },
    [activeIndex, isMobile]
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
  const commitPhoto = useCallback((index: number, direction?: "left" | "right") => {
    prevActiveIndexRef.current = activeIndex;
    if (direction) {
      setSlideDirection(direction);
    }
    setActiveIndex(index);
    setFocusedIndex(index);
  }, [activeIndex]);

  // Mouse hover event handlers for desktop
  const handleMouseEnter = () => {
    const mobile = typeof window !== "undefined" ? window.innerWidth < 640 : isMobile;
    if (!mobile) {
      openFan();
    }
  };

  const handleMouseLeave = () => {
    const mobile = typeof window !== "undefined" ? window.innerWidth < 640 : isMobile;
    if (!mobile) {
      closeFan();
    }
  };

  // Close fan if user clicks outside on desktop
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
      commitPhoto(prev, "right");
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = (activeIndex + 1) % total;
      commitPhoto(next, "left");
    } else if ((e.key === "Enter" || e.key === " ") && !isMobile) {
      e.preventDefault();
      setIsFanned((prev) => !prev);
    }
  };

  // Helper to resolve which photograph index corresponds to a touch/drag point on desktop
  const resolveIndexAtPoint = (clientX: number, clientY: number): number | null => {
    if (typeof document === "undefined") return null;

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

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const relX = (clientX - rect.left) / rect.width;
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

  // Pointer event handlers for desktop mouse interaction
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isMobile || e.pointerType === "touch") return;
    isPointerDown.current = true;
    pointerStartX.current = e.clientX;
    pointerStartY.current = e.clientY;
    hasDragged.current = false;
    wasAlreadyFannedOnDown.current = isFanned;

    if (!isFanned) {
      openFan();
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isMobile || e.pointerType === "touch" || !isPointerDown.current) return;
    const dx = e.clientX - pointerStartX.current;
    const dy = e.clientY - pointerStartY.current;

    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 0.8) {
      hasDragged.current = true;
      const candidate = resolveIndexAtPoint(e.clientX, e.clientY);
      if (candidate !== null && candidate !== focusedIndex) {
        setFocusedIndex(candidate);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isMobile || e.pointerType === "touch" || !isPointerDown.current) return;
    isPointerDown.current = false;

    if (hasDragged.current) {
      commitPhoto(focusedIndex);
    } else if (wasAlreadyFannedOnDown.current) {
      const candidate = resolveIndexAtPoint(e.clientX, e.clientY);
      if (candidate !== null) {
        commitPhoto(candidate);
      }
      setIsFanned(false);
    }
    hasDragged.current = false;
  };

  const handlePointerCancel = () => {
    isPointerDown.current = false;
    hasDragged.current = false;
  };

  // Mobile Touch Swipe Handlers (Only active for mobile/touch)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    isSwipingRef.current = false;
    isVerticalScrollRef.current = false;
    setDragOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || isVerticalScrollRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    // Detect direction intent
    if (!isSwipingRef.current) {
      // If vertical movement dominates, allow native page scroll completely unhindered
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
        isVerticalScrollRef.current = true;
        return;
      }
      // If horizontal movement dominates, engage horizontal swipe
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        isSwipingRef.current = true;
      }
    }

    if (isSwipingRef.current) {
      // Responsive live finger dragging with subtle resistance
      setDragOffset(dx);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const start = touchStartRef.current;
    touchStartRef.current = null;

    if (isVerticalScrollRef.current) {
      isVerticalScrollRef.current = false;
      setDragOffset(0);
      return;
    }

    if (isSwipingRef.current) {
      const touch = e.changedTouches[0];
      const dx = touch ? touch.clientX - start.x : dragOffset;
      const dy = touch ? touch.clientY - start.y : 0;
      const duration = Date.now() - start.time;
      const isQuickFlick = duration < 320 && Math.abs(dx) > 28;
      const isDragSwipe = Math.abs(dx) >= 44;

      if ((isQuickFlick || isDragSwipe) && Math.abs(dx) > Math.abs(dy) * 1.1) {
        if (dx < 0) {
          // Swiped left -> reveal Next photograph
          const next = (activeIndex + 1) % total;
          commitPhoto(next, "left");
        } else {
          // Swiped right -> reveal Previous photograph
          const prev = (activeIndex - 1 + total) % total;
          commitPhoto(prev, "right");
        }
      }
    }

    isSwipingRef.current = false;
    setDragOffset(0);
  };

  const handleTouchCancel = () => {
    touchStartRef.current = null;
    isSwipingRef.current = false;
    isVerticalScrollRef.current = false;
    setDragOffset(0);
  };

  // Mobile Slide Transform Calculation (Keeps photograph cleanly framed inside the aperture)
  const getMobileTransform = (index: number) => {
    const isCurrentActive = index === activeIndex;
    const isPrevActive = index === prevActiveIndexRef.current;
    const isNextInLine = index === (activeIndex + 1) % total;
    const isPrevInLine = index === (activeIndex - 1 + total) % total;

    if (isCurrentActive) {
      return {
        x: dragOffset,
        y: 0,
        rotate: dragOffset * 0.015,
        scale: 1,
        opacity: 1,
        zIndex: 20,
      };
    }

    // Dynamic live peek while finger is dragging horizontally
    if (dragOffset < 0 && isNextInLine) {
      return {
        x: `calc(100% + ${dragOffset}px)`,
        y: 0,
        rotate: 0,
        scale: 0.95 + Math.min(Math.abs(dragOffset) / 800, 0.05),
        opacity: Math.min(Math.abs(dragOffset) / 100, 1),
        zIndex: 19,
      };
    }

    if (dragOffset > 0 && isPrevInLine) {
      return {
        x: `calc(-100% + ${dragOffset}px)`,
        y: 0,
        rotate: 0,
        scale: 0.95 + Math.min(Math.abs(dragOffset) / 800, 0.05),
        opacity: Math.min(Math.abs(dragOffset) / 100, 1),
        zIndex: 19,
      };
    }

    // Outgoing photo during slide completion
    if (isPrevActive && !isCurrentActive) {
      const exitX = slideDirection === "left" ? -70 : slideDirection === "right" ? 70 : 0;
      return {
        x: exitX,
        y: 0,
        rotate: 0,
        scale: 0.96,
        opacity: 0,
        zIndex: 10,
      };
    }

    // Inactive hidden photographs
    return {
      x: 0,
      y: 0,
      rotate: 0,
      scale: 0.95,
      opacity: 0,
      zIndex: 0,
    };
  };

  // Desktop Fan Slot Transform Calculation (100% Preserved)
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

    let x = 0;
    let y = 0;
    let rotate = 0;
    let scale = 0.91;
    let zIndex = 15;

    if (diff === 0) {
      x = 0;
      y = -12;
      rotate = 0;
      scale = 1.02;
      zIndex = 40;
    } else if (diff === 1) {
      x = 92;
      y = -6;
      rotate = 8.5;
      scale = 0.91;
      zIndex = 25;
    } else if (diff === 2) {
      x = -135;
      y = -2;
      rotate = -12.5;
      scale = 0.87;
      zIndex = 15;
    } else if (diff === 3) {
      x = -72;
      y = -6;
      rotate = -7;
      scale = 0.92;
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

  const currentIsMobile = typeof window !== "undefined" ? window.innerWidth < 640 : isMobile;

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
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      className="relative mt-3 sm:mt-4 aspect-[4/4.7] select-none touch-pan-y cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:overflow-visible overflow-hidden rounded-xl sm:rounded-2xl"
    >
      {/* Base photo aperture / backing frame */}
      <div className="absolute inset-0 rounded-xl sm:rounded-2xl border border-border bg-surface-secondary/80 pointer-events-none" />

      {/* Invisible hover zone padding when fanned on desktop so mouse can move freely between cards */}
      {!currentIsMobile && isFanned && (
        <div
          className="absolute -inset-x-32 -inset-y-12 z-0 pointer-events-auto"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
      )}

      {/* Layered Photographs: Desktop Arc Fan vs Mobile Clean Slide Carousel */}
      {images.map((img, idx) => {
        const isCenter = idx === focusedIndex;
        const transform = currentIsMobile ? getMobileTransform(idx) : getFanTransform(idx);

        return (
          <motion.div
            key={img.src}
            data-photo-index={idx}
            animate={transform}
            transition={
              prefersReduced
                ? { duration: 0.25 }
                : currentIsMobile
                ? {
                    type: "spring",
                    stiffness: 260,
                    damping: 26,
                    mass: 0.8,
                    opacity: { duration: 0.35, ease: "easeInOut" },
                  }
                : {
                    type: "spring",
                    stiffness: 95,
                    damping: 17,
                    mass: 0.85,
                    opacity: { duration: 0.45, ease: "easeInOut" },
                  }
            }
            onPointerEnter={(e) => {
              if (!currentIsMobile && e.pointerType === "mouse" && isFanned && idx !== focusedIndex) {
                setFocusedIndex(idx);
              }
            }}
            onClick={(e) => {
              if (!currentIsMobile) {
                e.stopPropagation();
                commitPhoto(idx);
              }
            }}
            className={`absolute inset-0 w-full h-full rounded-xl sm:rounded-2xl overflow-hidden transition-shadow duration-500 ${
              isCenter || currentIsMobile
                ? "shadow-2xl border border-white/25 dark:border-white/15"
                : isFanned
                ? "shadow-xl border border-white/20 dark:border-white/10"
                : ""
            }`}
            style={{
              transformOrigin: currentIsMobile ? "50% 50%" : "50% 88%",
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

            {/* Depth vignette on background side cards when fan is active on desktop */}
            {!isMobile && isFanned && !isCenter && (
              <div className="absolute inset-0 bg-black/15 dark:bg-black/25 pointer-events-none transition-colors duration-400" />
            )}
          </motion.div>
        );
      })}

      {/* Mobile Slide Pagination Indicator (Clean, subtle capsule dots) */}
      <div
        className="sm:hidden absolute bottom-2.5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/45 backdrop-blur-md border border-white/10 pointer-events-none"
        aria-hidden="true"
      >
        {images.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === activeIndex
                ? "w-4 bg-accent shadow-[0_0_8px_rgba(232,255,112,0.6)]"
                : "w-1.5 bg-white/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
