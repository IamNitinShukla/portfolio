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

  const containerRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<NodeJS.Timeout | null>(null);
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
  const commitPhoto = useCallback((index: number) => {
    setActiveIndex(index);
    setFocusedIndex(index);
  }, []);

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
      commitPhoto(prev);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = (activeIndex + 1) % total;
      commitPhoto(next);
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

  // Mobile Touch Swipe Handlers (Seamlessly navigate within the rainbow fan formation)
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
      // Subtle responsive tactile feedback during finger drag
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
      const isQuickFlick = duration < 320 && Math.abs(dx) > 25;
      const isDragSwipe = Math.abs(dx) >= 40;

      if ((isQuickFlick || isDragSwipe) && Math.abs(dx) > Math.abs(dy) * 1.1) {
        if (dx < 0) {
          // Swiped left -> move to Next photograph in rainbow formation
          const next = (activeIndex + 1) % total;
          commitPhoto(next);
        } else {
          // Swiped right -> move to Previous photograph in rainbow formation
          const prev = (activeIndex - 1 + total) % total;
          commitPhoto(prev);
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

  // Mobile Rainbow Fan Transform Calculation:
  // Preserves the genuine curved 3D layered rainbow formation on mobile at all times.
  // diff === 0: Center Apex (Selected photograph in front, dominant, upright)
  // diff === 1: Right Card (Tilted right, partially visible behind)
  // diff === 2: Far Left Card (Tilted left, furthest background layer)
  // diff === 3: Near Left Card (Tilted left, between center and far left)
  const getMobileRainbowTransform = (index: number) => {
    const diff = (index - activeIndex + total) % total;

    if (diff === 0) {
      return {
        x: dragOffset * 0.25,
        y: -8,
        rotate: dragOffset * 0.02,
        scale: 1.0,
        opacity: 1,
        zIndex: 40,
      };
    } else if (diff === 1) {
      return {
        x: 22 + dragOffset * 0.1,
        y: -4,
        rotate: 6 + dragOffset * 0.01,
        scale: 0.89,
        opacity: 1,
        zIndex: 25,
      };
    } else if (diff === 2) {
      return {
        x: -30 + dragOffset * 0.1,
        y: -1,
        rotate: -9 + dragOffset * 0.01,
        scale: 0.86,
        opacity: 1,
        zIndex: 15,
      };
    } else if (diff === 3) {
      return {
        x: -16 + dragOffset * 0.1,
        y: -4,
        rotate: -5 + dragOffset * 0.01,
        scale: 0.9,
        opacity: 1,
        zIndex: 25,
      };
    }

    return {
      x: 0,
      y: 0,
      rotate: 0,
      scale: 0.9,
      opacity: 1,
      zIndex: 10,
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
      className="relative mt-3 sm:mt-4 aspect-[4/4.7] select-none touch-pan-y cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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

      {/* Layered Photographs: Mobile Continuous Rainbow Fan vs Desktop Hover Arc Fan */}
      {images.map((img, idx) => {
        const isCenter = currentIsMobile ? idx === activeIndex : idx === focusedIndex;
        const transform = currentIsMobile ? getMobileRainbowTransform(idx) : getFanTransform(idx);

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
                    stiffness: 140,
                    damping: 20,
                    mass: 0.85,
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
              isCenter
                ? "shadow-2xl border border-white/25 dark:border-white/15"
                : isFanned || currentIsMobile
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

            {/* Depth vignette on background side cards in rainbow fan */}
            {((currentIsMobile && !isCenter) || (!currentIsMobile && isFanned && !isCenter)) && (
              <div className="absolute inset-0 bg-black/15 dark:bg-black/25 pointer-events-none transition-colors duration-400" />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
