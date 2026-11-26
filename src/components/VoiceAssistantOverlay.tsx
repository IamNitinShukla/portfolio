"use client";

import { motion } from "framer-motion";
import { MessageSquare, Mic, MicOff, X } from "lucide-react";
import type { VoiceState } from "@/lib/useVoiceAssistant";

interface VoiceAssistantOverlayProps {
  voiceState: VoiceState;
  finalTranscript: string;
  isMuted: boolean;
  errorMessage: string | null;
  onInterrupt?: () => void;
  onToggleMute: () => void;
  onExit: () => void;
  onClose?: () => void;
  onRetry?: () => void;
  audioLevel?: number;
}

/**
 * Maps the current voice state to the appropriate transparent mascot animation clip.
 */
function getMascotAnimationSrc(voiceState: VoiceState, isMuted: boolean): string {
  if (isMuted) return "/mascot/animations/idle.webm";
  switch (voiceState) {
    case "speaking":
      return "/mascot/animations/wave.webm";
    case "transcribing":
    case "generating":
      return "/mascot/animations/look-around.webm";
    case "listening":
    case "recording":
      return "/mascot/animations/idle.webm";
    case "error":
      return "/mascot/animations/shrug.webm";
    default:
      return "/mascot/animations/idle.webm";
  }
}

export default function VoiceAssistantOverlay({
  voiceState,
  finalTranscript,
  isMuted,
  errorMessage,
  onInterrupt,
  onToggleMute,
  onExit,
  onClose,
  onRetry,
  audioLevel,
}: VoiceAssistantOverlayProps) {
  const isUserSpeaking = voiceState === "recording";
  // Determine primary state headline
  const stateHeadline = isMuted
    ? "Microphone Muted"
    : voiceState === "listening" || voiceState === "recording"
    ? isUserSpeaking
      ? "Listening to you..."
      : "Listening..."
    : voiceState === "transcribing"
    ? "Processing speech..."
    : voiceState === "generating"
    ? "Thinking..."
    : voiceState === "speaking"
    ? "Friday is speaking..."
    : voiceState === "error"
    ? "Microphone Notice"
    : "Voice Mode Ready";

  // Determine secondary contextual subtitle
  const stateSubtitle = isMuted
    ? "Tap the microphone below to unmute"
    : voiceState === "speaking"
    ? "Tap anywhere to interrupt"
    : (voiceState === "generating" || voiceState === "transcribing") && finalTranscript
    ? `"${finalTranscript}"`
    : voiceState === "listening" || isUserSpeaking
    ? isUserSpeaking
      ? "Capturing your question..."
      : "Speak now, Friday is listening"
    : errorMessage || "Speak naturally with Friday";

  const mascotSrc = getMascotAnimationSrc(voiceState, isMuted);
  const isSpeaking = voiceState === "speaking";

  return (
    <div
      data-testid="voice-assistant-overlay"
      className="absolute inset-0 z-30 flex flex-col items-center justify-between bg-[#07080A]/95 p-5 backdrop-blur-md transition-all duration-300 select-none"
      onClick={() => {
        // Tapping anywhere on the overlay when Friday is speaking triggers Tap-to-Interrupt
        if (isSpeaking && onInterrupt) {
          onInterrupt();
        }
      }}
    >
      {/* Top Navigation & Minimal Controls */}
      <div
        className="flex w-full items-center justify-between text-xs text-neutral-400"
        onClick={e => e.stopPropagation()}
      >
        {/* State Badge with Ambient Pulse */}
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full transition-colors duration-300 ${
              isMuted
                ? "bg-neutral-600"
                : isSpeaking
                ? "animate-pulse bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                : voiceState === "generating" || voiceState === "transcribing"
                ? "animate-pulse bg-red-400"
                : isUserSpeaking
                ? "animate-ping bg-red-500"
                : "bg-red-500"
            }`}
          />
          <span
            data-testid="voice-state-label"
            className="font-medium tracking-wider text-[11px] uppercase text-neutral-300"
          >
            {stateHeadline}
          </span>
        </div>

        {/* Minimal Controls: Text Chat & Close */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExit}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-neutral-300 transition-all hover:bg-white/10 hover:text-white"
            aria-label="Switch to Text Chat"
          >
            <MessageSquare size={13} />
            <span>Text Chat</span>
          </button>

          <button
            type="button"
            onClick={onClose || onExit}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-neutral-400 transition-all hover:bg-white/10 hover:text-white"
            aria-label="Close Friday Voice Mode"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Center Centerpiece: Red Robot Mascot & Ambient Red Glow */}
      <div className="relative flex flex-1 flex-col items-center justify-center w-full max-w-sm py-4">
        {/* Soft Ambient Red Glow Layer Behind Robot */}
        <div className="relative flex items-center justify-center">
          {/* Outermost Diffuse Red Aura */}
          <motion.div
            className="absolute rounded-full pointer-events-none blur-3xl"
            animate={
              isMuted
                ? {
                    scale: 0.8,
                    opacity: 0.12,
                    background:
                      "radial-gradient(circle, rgba(185,28,28,0.3) 0%, transparent 70%)",
                  }
                : isSpeaking
                ? {
                    scale: [1.1, 1.35, 1.15, 1.38, 1.1],
                    opacity: [0.65, 0.92, 0.7, 0.95, 0.65],
                    background:
                      "radial-gradient(circle, rgba(239,68,68,0.6) 0%, rgba(220,38,38,0.3) 45%, transparent 70%)",
                  }
                : voiceState === "generating" || voiceState === "transcribing"
                ? {
                    scale: [0.95, 1.18, 0.95],
                    opacity: [0.4, 0.7, 0.4],
                    background:
                      "radial-gradient(circle, rgba(248,113,113,0.45) 0%, rgba(185,28,28,0.2) 50%, transparent 70%)",
                  }
                : isUserSpeaking
                ? {
                    scale: [1.1, 1.3, 1.1],
                    opacity: [0.6, 0.88, 0.6],
                    background:
                      "radial-gradient(circle, rgba(239,68,68,0.55) 0%, rgba(220,38,38,0.25) 50%, transparent 70%)",
                  }
                : {
                    scale: [0.95, 1.08, 0.95],
                    opacity: [0.35, 0.55, 0.35],
                    background:
                      "radial-gradient(circle, rgba(239,68,68,0.4) 0%, rgba(185,28,28,0.18) 50%, transparent 70%)",
                  }
            }
            transition={
              isSpeaking
                ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
                : voiceState === "generating"
                ? { duration: 2.8, repeat: Infinity, ease: "easeInOut" }
                : isUserSpeaking
                ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
                : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
            }
            style={{ width: "260px", height: "260px" }}
          />

          {/* Concentric Soft Red Pulse Ring */}
          <motion.div
            className="absolute rounded-full border border-red-500/25 pointer-events-none"
            animate={
              isSpeaking
                ? { scale: [1, 1.25, 1], opacity: [0.6, 0.1, 0.6] }
                : isUserSpeaking
                ? { scale: [1, 1.2, 1], opacity: [0.5, 0.12, 0.5] }
                : voiceState === "generating"
                ? { scale: [1, 1.1, 1], opacity: [0.3, 0.1, 0.3] }
                : { scale: 1, opacity: 0.15 }
            }
            transition={{
              duration: isSpeaking ? 1.5 : isUserSpeaking ? 1.2 : 2.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{ width: "220px", height: "220px" }}
          />

          {/* Interactive Red Robot Mascot Centerpiece */}
          <div
            className={`relative z-10 flex items-center justify-center cursor-pointer transition-transform duration-200 active:scale-95`}
            title={isSpeaking ? "Tap to interrupt Friday" : "Friday AI Mascot"}
          >
            <video
              key={mascotSrc}
              src={mascotSrc}
              autoPlay
              loop
              muted
              playsInline
              aria-hidden="true"
              className="h-44 w-44 sm:h-52 sm:w-52 object-contain pointer-events-none drop-shadow-[0_12px_32px_rgba(239,68,68,0.28)]"
            />
          </div>
        </div>

        {/* Subtle Status Text and Transcript Subtitle Below Mascot */}
        <div className="mt-5 flex flex-col items-center justify-center text-center px-4">
          <p className="text-base font-medium tracking-wide text-white">
            {stateHeadline}
          </p>
          <p className="mt-1 text-xs text-neutral-400 line-clamp-2 max-w-xs transition-opacity duration-300">
            {stateSubtitle}
          </p>
          {voiceState === "error" && <button type="button" className="mt-2 underline" onClick={onRetry}>Retry voice</button>}
        </div>
      </div>

      {/* Bottom Minimal Controls: 1 Microphone Toggle */}
      <div
        className="flex items-center justify-center w-full pb-2"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => {
            if (isSpeaking && onInterrupt) {
              onInterrupt();
            } else {
              onToggleMute();
            }
          }}
          className={`group relative flex h-14 w-14 items-center justify-center rounded-full transition-all duration-300 shadow-lg ${
            isMuted
              ? "border border-neutral-700 bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white"
              : isSpeaking
              ? "border border-red-500/50 bg-gradient-to-tr from-red-600 to-red-500 text-white shadow-red-500/40 hover:scale-105"
              : "border border-red-500/40 bg-gradient-to-tr from-red-600/90 to-red-500/90 text-white shadow-red-500/30 hover:scale-105"
          }`}
          aria-label={
            isMuted
              ? "Unmute microphone"
              : isSpeaking
              ? "Tap to interrupt"
              : "Mute microphone"
          }
          title={
            isMuted
              ? "Unmute microphone"
              : isSpeaking
              ? "Tap to interrupt"
              : "Mute microphone"
          }
        >
          {isMuted ? (
            <MicOff size={22} />
          ) : (
            <Mic size={22} className="transition-transform group-hover:scale-110" />
          )}
        </button>
      </div>
    </div>
  );
}
