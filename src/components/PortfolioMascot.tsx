"use client";

import { useId, useState, useRef, useEffect } from "react";
import MascotAssistantDialog from "@/components/MascotAssistantDialog";
import styles from "./MascotInteraction.module.css";
import { useMascotController } from "@/lib/useMascotController";
import type { MascotAnimationName } from "@/config/mascotConfig";

export interface PortfolioMascotProps {
  /** Optional initial animation name */
  initialAnimation?: MascotAnimationName;
  /** Optional custom CSS classes for the positioned mascot */
  className?: string;
}

export default function PortfolioMascot({
  initialAnimation = "idle",
  className = "",
}: PortfolioMascotProps) {
  const controller = useMascotController(initialAnimation);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [startInVoiceMode, setStartInVoiceMode] = useState(false);
  const [isHiddenByPhilosophy, setIsHiddenByPhilosophy] = useState(false);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<number>(0);
  const dialogId = useId();
  const {
    activeSlot,
    videoRef,
    isLoaded,
    prefersReduced,
    slot0,
    slot1,
    videoRef0,
    videoRef1,
    handlePlaying0,
    handlePlaying1,
    handleEnded0,
    handleEnded1,
    handleLoadedData,
  } = controller;

  // Reliably hide the mascot while the user is inside the 4-stage pinned Philosophy section
  useEffect(() => {
    const philosophyEl = document.getElementById("philosophy");
    if (!philosophyEl) return;

    const checkVisibility = () => {
      const rect = philosophyEl.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      // Philosophy (#philosophy) has h-[400vh] with a sticky viewport container.
      // It is active when its top is at or above 25% of viewport and bottom is at or above 25% of viewport.
      const inSection = rect.top <= vh * 0.25 && rect.bottom >= vh * 0.25;
      setIsHiddenByPhilosophy(inSection);
    };

    checkVisibility();

    window.addEventListener("scroll", checkVisibility, { passive: true });
    window.addEventListener("resize", checkVisibility, { passive: true });

    const observer = new IntersectionObserver(
      () => {
        checkVisibility();
      },
      {
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0],
      }
    );
    observer.observe(philosophyEl);

    return () => {
      window.removeEventListener("scroll", checkVisibility);
      window.removeEventListener("resize", checkVisibility);
      observer.disconnect();
    };
  }, []);

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      // Double click detected: launch voice mode
      setStartInVoiceMode(true);
      setAssistantOpen(true);
      return;
    }

    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      // Single click: open standard conversational dialog
      setStartInVoiceMode(false);
      setAssistantOpen(true);
    }, 280);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    setStartInVoiceMode(true);
    setAssistantOpen(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const now = Date.now();
    const timeDiff = now - lastTapRef.current;
    if (timeDiff > 0 && timeDiff < 340) {
      // Double tap on mobile
      e.preventDefault();
      e.stopPropagation();
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      lastTapRef.current = 0;
      setStartInVoiceMode(true);
      setAssistantOpen(true);
    } else {
      lastTapRef.current = now;
    }
  };

  return (
    <>
      <div
        className={`pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-40 w-24 max-w-[25vw] sm:w-32 lg:bottom-[max(6px,env(safe-area-inset-bottom))] lg:right-[max(2px,env(safe-area-inset-right))] lg:w-44 aspect-square transition-all duration-300 ease-out ${
          isHiddenByPhilosophy
            ? "opacity-0 pointer-events-none translate-y-3 invisible"
            : "opacity-100 visible translate-y-0"
        } ${className}`}
        aria-hidden={isHiddenByPhilosophy}
      >
        <button
          type="button"
          data-testid="mascot-assistant-trigger"
          tabIndex={isHiddenByPhilosophy ? -1 : 0}
          disabled={isHiddenByPhilosophy}
          className={`${styles.trigger} cursor-pointer hover:scale-105 active:scale-95 transition-transform duration-200`}
          aria-label="Friday, Nitin’s personal AI assistant. Click to chat, double-click for voice conversation."
          title="Click to chat, double-click for voice mode"
          aria-haspopup="dialog"
          aria-expanded={assistantOpen}
          aria-controls={dialogId}
          onClick={handleTriggerClick}
          onDoubleClick={handleDoubleClick}
          onTouchEnd={handleTouchEnd}
        />

        {/* Seamless Double-Buffered Mascot Video Element 0 */}
        <video
          ref={videoRef0}
          src={slot0.src}
          autoPlay={!prefersReduced}
          muted
          playsInline
          aria-hidden="true"
          tabIndex={-1}
          preload="auto"
          onEnded={handleEnded0}
          onPlaying={handlePlaying0}
          onLoadedData={handleLoadedData}
          className={`pointer-events-none absolute inset-0 block h-full w-full select-none bg-transparent transition-opacity duration-100 ease-out ${
            activeSlot === 0 ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
          }`}
        />

        {/* Seamless Double-Buffered Mascot Video Element 1 */}
        {slot1.src ? (
          <video
            ref={videoRef1}
            src={slot1.src}
            autoPlay={!prefersReduced}
            muted
            playsInline
            aria-hidden="true"
            tabIndex={-1}
            preload="auto"
            onEnded={handleEnded1}
            onPlaying={handlePlaying1}
            onLoadedData={handleLoadedData}
            className={`pointer-events-none absolute inset-0 block h-full w-full select-none bg-transparent transition-opacity duration-100 ease-out ${
              activeSlot === 1 ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
            }`}
          />
        ) : null}
      </div>
      {assistantOpen && (
        <MascotAssistantDialog
          id={dialogId}
          mascotVideo={videoRef}
          startInVoiceMode={startInVoiceMode}
          onDismiss={() => {
            setAssistantOpen(false);
            setStartInVoiceMode(false);
          }}
        />
      )}
    </>
  );
}
