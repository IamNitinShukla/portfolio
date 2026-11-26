"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { portfolioData, ProfileImage } from "@/data/portfolioData";
import SpiderMascot from "@/components/SpiderMascot";

interface ProfilePhotoCarouselProps {
  images?: ProfileImage[];
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : direction < 0 ? "-100%" : 0,
    opacity: 0,
    scale: 0.98,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      x: { type: "spring", stiffness: 300, damping: 30 },
      opacity: { duration: 0.35, ease: "easeOut" },
      scale: { duration: 0.35, ease: "easeOut" },
    },
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction > 0 ? "-100%" : direction < 0 ? "100%" : 0,
    opacity: 0,
    scale: 0.98,
    transition: {
      x: { type: "spring", stiffness: 300, damping: 30 },
      opacity: { duration: 0.25, ease: "easeIn" },
      scale: { duration: 0.25, ease: "easeIn" },
    },
  }),
};

const reducedMotionVariants = {
  enter: {
    opacity: 0,
  },
  center: {
    zIndex: 1,
    opacity: 1,
    transition: {
      opacity: { duration: 0.3, ease: "easeInOut" },
    },
  },
  exit: {
    zIndex: 0,
    opacity: 0,
    transition: {
      opacity: { duration: 0.2, ease: "easeInOut" },
    },
  },
};

export default function ProfilePhotoCarousel({
  images = portfolioData.personal.profileImages,
}: ProfilePhotoCarouselProps) {
  const [[page, direction], setPage] = useState<[number, number]>([0, 0]);
  const [isAnimating, setIsAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();

  const total = images.length;
  // Calculate current zero-based index wrapping safely
  const currentIndex = ((page % total) + total) % total;
  const currentImage = images[currentIndex] || images[0];

  const paginate = useCallback(
    (newDirection: number) => {
      if (isAnimating) return;
      setIsAnimating(true);
      setPage(([prevPage]) => [prevPage + newDirection, newDirection]);
    },
    [isAnimating]
  );

  const jumpTo = useCallback(
    (targetIndex: number) => {
      if (isAnimating || targetIndex === currentIndex) return;
      setIsAnimating(true);
      const diff = targetIndex - currentIndex;
      const newDirection = diff > 0 ? 1 : -1;
      setPage(([prevPage]) => [prevPage + diff, newDirection]);
    },
    [isAnimating, currentIndex]
  );

  // Keyboard navigation when focused
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      paginate(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      paginate(1);
    }
  };

  // Preload adjacent images in browser cache for instantaneous transitions
  useEffect(() => {
    if (typeof window === "undefined" || !images.length) return;
    const nextIdx = (currentIndex + 1) % total;
    const prevIdx = (currentIndex - 1 + total) % total;
    const preloadList = [images[nextIdx]?.src, images[prevIdx]?.src].filter(Boolean);
    preloadList.forEach((src) => {
      const img = new window.Image();
      img.src = src;
    });
  }, [currentIndex, images, total]);

  const activeVariants = prefersReduced ? reducedMotionVariants : slideVariants;

  return (
    <div
      ref={containerRef}
      role="region"
      aria-roledescription="carousel"
      aria-label="Nitin Shukla Photograph Gallery"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="relative mt-3 sm:mt-4 aspect-[4/4.7] rounded-xl sm:rounded-2xl overflow-hidden border border-border bg-surface-secondary select-none touch-pan-y group/carousel focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {/* Animated Image Container */}
      <AnimatePresence
        initial={false}
        custom={direction}
        mode="popLayout"
        onExitComplete={() => setIsAnimating(false)}
      >
        <motion.div
          key={page}
          custom={direction}
          variants={activeVariants}
          initial="enter"
          animate="center"
          exit="exit"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(_e, { offset, velocity }) => {
            const swipeThreshold = 40;
            const velocityThreshold = 400;
            if (offset.x > swipeThreshold || velocity.x > velocityThreshold) {
              paginate(-1);
            } else if (offset.x < -swipeThreshold || velocity.x < -velocityThreshold) {
              paginate(1);
            }
          }}
          className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
        >
          <Image
            src={currentImage.src}
            alt={currentImage.alt}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 390px"
            priority={currentIndex === 0}
            unoptimized
            className="object-cover object-center transition-transform duration-700 ease-out group-hover/carousel:scale-[1.02]"
          />
        </motion.div>
      </AnimatePresence>

      {/* Cinematic Ambient Scanline & Vignette Gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface/90 via-surface/15 to-transparent z-10" />

      {/* Top Floating Badge: AI Systems & SWE */}
      <div className="pointer-events-none absolute top-2.5 left-2.5 sm:top-3 sm:left-3 z-20 flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg bg-surface/85 backdrop-blur-md border border-border text-[10px] sm:text-[11px] font-mono text-primary shadow-sm">
        <Sparkles className="w-3 h-3 text-accent" />
        <span>AI Systems &amp; SWE</span>
      </div>

      {/* Interactive Robotic Spider Mascot hanging on card */}
      <div className="absolute top-2 right-2 z-20 animate-float-spider pointer-events-auto">
        <SpiderMascot size={44} />
      </div>

      {/* Direction-Aware Arrow Controls */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          paginate(-1);
        }}
        aria-label={`Previous photograph (Image ${((currentIndex - 1 + total) % total) + 1} of ${total})`}
        className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-surface/80 hover:bg-surface text-primary hover:text-accent border border-border/80 hover:border-accent backdrop-blur-md flex items-center justify-center transition-all duration-200 shadow-md active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent opacity-85 sm:opacity-0 sm:group-hover/carousel:opacity-100 group/btn"
      >
        <ChevronLeft className="w-4 h-4 transition-transform group-hover/btn:-translate-x-0.5" />
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          paginate(1);
        }}
        aria-label={`Next photograph (Image ${((currentIndex + 1) % total) + 1} of ${total})`}
        className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-surface/80 hover:bg-surface text-primary hover:text-accent border border-border/80 hover:border-accent backdrop-blur-md flex items-center justify-center transition-all duration-200 shadow-md active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent opacity-85 sm:opacity-0 sm:group-hover/carousel:opacity-100 group/btn"
      >
        <ChevronRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-0.5" />
      </button>

      {/* Floating Bottom Bar: Counter Position & Slide Indicators */}
      <div className="absolute bottom-2.5 inset-x-2.5 z-20 flex items-center justify-between px-3 py-1.5 rounded-full bg-surface/80 backdrop-blur-md border border-border/70 shadow-sm pointer-events-auto">
        {/* Monospace Position Counter */}
        <span className="font-mono text-[10px] sm:text-[11px] font-bold text-primary-muted tracking-wider select-none">
          {String(currentIndex + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>

        {/* Interactive Indicator Pills */}
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Slides">
          {images.map((img, idx) => {
            const isActive = idx === currentIndex;
            return (
              <button
                key={img.src}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Go to photograph ${idx + 1}: ${img.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  jumpTo(idx);
                }}
                className={`transition-all duration-300 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  isActive
                    ? "w-5 sm:w-6 h-1.5 bg-accent shadow-sm shadow-accent/50"
                    : "w-1.5 h-1.5 bg-primary/25 hover:bg-primary/50"
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
