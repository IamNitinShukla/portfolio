"use client";

import { motion } from "framer-motion";
import { useId, useState, useRef } from "react";
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
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<number>(0);
  const dialogId = useId();
  const { videoRef, isLoaded, prefersReduced, videoProps, currentAnimation } = controller;

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      // Double click detected: launch Voice Mode directly
      setStartInVoiceMode(true);
      setAssistantOpen(true);
      return;
    }

    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      // Single click: open standard conversational dialog
      setStartInVoiceMode(false);
      setAssistantOpen(open => !open);
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
      <div className={`pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-30 w-24 max-w-[25vw] sm:w-32 lg:bottom-[max(6px,env(safe-area-inset-bottom))] lg:right-[max(2px,env(safe-area-inset-right))] lg:w-44 ${className}`}>
        <button
          type="button"
          data-testid="mascot-assistant-trigger"
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
        <motion.video
          {...videoProps}
          ref={videoRef}
          aria-hidden="true"
          tabIndex={-1}
          preload="auto"
          data-animation={currentAnimation}
          className="pointer-events-none relative block h-auto w-full select-none bg-transparent"
          initial={false}
          animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded || prefersReduced ? 0 : 8 }}
          transition={{ duration: prefersReduced ? 0 : 0.35, ease: "easeOut" }}
        />
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
