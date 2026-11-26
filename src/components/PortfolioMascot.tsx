"use client";

import { motion } from "framer-motion";
import { useId, useState } from "react";
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
  const dialogId = useId();
  const { videoRef, isLoaded, prefersReduced, videoProps, currentAnimation } = controller;

  return (
    <>
      <div className={`pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-30 w-24 max-w-[25vw] sm:w-32 lg:bottom-[max(6px,env(safe-area-inset-bottom))] lg:right-[max(2px,env(safe-area-inset-right))] lg:w-44 ${className}`}>
        <button
          type="button"
          data-testid="mascot-assistant-trigger"
          className={styles.trigger}
          aria-label="Friday, Nitin Sir’s personal AI assistant"
          aria-haspopup="dialog"
          aria-expanded={assistantOpen}
          aria-controls={dialogId}
          onClick={() => setAssistantOpen(open => !open)}
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
      {assistantOpen && <MascotAssistantDialog id={dialogId} mascotVideo={videoRef} onDismiss={() => setAssistantOpen(false)} />}
    </>
  );
}
