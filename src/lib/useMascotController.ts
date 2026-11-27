"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  DEFAULT_MASCOT_ANIMATION,
  isMascotAnimation,
  MASCOT_ANIMATIONS,
  type MascotAnimationName,
} from "@/config/mascotConfig";
import { useMascotBehaviour } from "@/lib/useMascotBehaviour";

export const MASCOT_PLAY_EVENT = "mascot:play";

interface MascotRequest {
  name: MascotAnimationName;
  onAccepted?: () => void;
}

/** Queue a preference for the next eligible clip boundary. */
export function requestMascotAnimation(name: MascotAnimationName): boolean {
  if (typeof window === "undefined") return false;
  let accepted = false;
  window.dispatchEvent(
    new CustomEvent<MascotRequest>(MASCOT_PLAY_EVENT, {
      detail: {
        name,
        onAccepted: () => {
          accepted = true;
        },
      },
    })
  );
  return accepted;
}

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getReducedMotion() {
  return window.matchMedia(reducedMotionQuery).matches;
}

function getServerReducedMotion() {
  return null;
}

export function useMascotController(initialAnimation: MascotAnimationName = DEFAULT_MASCOT_ANIMATION) {
  const initialName = isMascotAnimation(initialAnimation) && !MASCOT_ANIMATIONS[initialAnimation].isPending
    ? initialAnimation
    : DEFAULT_MASCOT_ANIMATION;

  const [activeSlot, setActiveSlot] = useState<0 | 1>(0);
  const activeSlotRef = useRef<0 | 1>(0);
  activeSlotRef.current = activeSlot;

  const [slot0, setSlot0] = useState<{ name: MascotAnimationName; src: string }>({
    name: initialName,
    src: MASCOT_ANIMATIONS[initialName].src,
  });

  const [slot1, setSlot1] = useState<{ name: MascotAnimationName; src: string }>({
    name: initialName,
    src: "",
  });

  const videoRef0 = useRef<HTMLVideoElement>(null);
  const videoRef1 = useRef<HTMLVideoElement>(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const requested = useRef<MascotAnimationName | null>(null);
  const isAdvancing = useRef(false);

  const { started, next } = useMascotBehaviour();
  const prefersReduced = useSyncExternalStore(subscribeToReducedMotion, getReducedMotion, getServerReducedMotion);

  // Resume playback on user gesture if browser autoplay policy blocked initial playback
  const setupAutoplayRecovery = useCallback(() => {
    if (typeof window === "undefined") return;
    const resumeOnInteraction = () => {
      window.removeEventListener("pointerdown", resumeOnInteraction);
      window.removeEventListener("touchstart", resumeOnInteraction);
      window.removeEventListener("scroll", resumeOnInteraction);
      const activeVideo = activeSlotRef.current === 0 ? videoRef0.current : videoRef1.current;
      if (activeVideo && activeVideo.paused && !document.hidden && !getReducedMotion()) {
        activeVideo.play().catch(() => {});
      }
    };
    window.addEventListener("pointerdown", resumeOnInteraction, { once: true, passive: true });
    window.addEventListener("touchstart", resumeOnInteraction, { once: true, passive: true });
    window.addEventListener("scroll", resumeOnInteraction, { once: true, passive: true });
  }, []);

  const advance = useCallback((fromSlot: 0 | 1, overrideName?: MascotAnimationName) => {
    if (document.hidden || getReducedMotion() || isAdvancing.current) return;

    const currentName = fromSlot === 0 ? slot0.name : slot1.name;
    const nextChoice = overrideName
      ? { name: overrideName }
      : next(currentName, false, requested.current);

    if (nextChoice.name) {
      isAdvancing.current = true;
      requested.current = null;
      const targetSlot = fromSlot === 0 ? 1 : 0;
      const nextAnimation = nextChoice.name;
      const nextSrc = MASCOT_ANIMATIONS[nextAnimation].src;

      if (targetSlot === 1) {
        setSlot1({ name: nextAnimation, src: nextSrc });
      } else {
        setSlot0({ name: nextAnimation, src: nextSrc });
      }
    }
  }, [slot0.name, slot1.name, next]);

  // When slot1 src changes and is target, start playing it
  useEffect(() => {
    if (slot1.src && activeSlotRef.current === 0 && isAdvancing.current) {
      const vid = videoRef1.current;
      if (vid) {
        vid.load();
        const p = vid.play();
        if (p !== undefined) {
          p.catch(err => {
            const isAutoplay = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "AbortError");
            if (isAutoplay) setupAutoplayRecovery();
          });
        }
      }
    }
  }, [slot1.src, setupAutoplayRecovery]);

  // When slot0 src changes and is target, start playing it
  useEffect(() => {
    if (slot0.src && activeSlotRef.current === 1 && isAdvancing.current) {
      const vid = videoRef0.current;
      if (vid) {
        vid.load();
        const p = vid.play();
        if (p !== undefined) {
          p.catch(err => {
            const isAutoplay = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "AbortError");
            if (isAutoplay) setupAutoplayRecovery();
          });
        }
      }
    }
  }, [slot0.src, setupAutoplayRecovery]);

  // Handle when Video 0 begins playing
  const handlePlaying0 = useCallback(() => {
    setIsLoaded(true);
    if (isAdvancing.current && activeSlotRef.current === 1) {
      setActiveSlot(0);
      isAdvancing.current = false;
      started(slot0.name);
      if (videoRef1.current) {
        videoRef1.current.pause();
      }
    }
  }, [slot0.name, started]);

  // Handle when Video 1 begins playing
  const handlePlaying1 = useCallback(() => {
    setIsLoaded(true);
    if (isAdvancing.current && activeSlotRef.current === 0) {
      setActiveSlot(1);
      isAdvancing.current = false;
      started(slot1.name);
      if (videoRef0.current) {
        videoRef0.current.pause();
      }
    }
  }, [slot1.name, started]);

  // Handle when Video 0 ends
  const handleEnded0 = useCallback(() => {
    if (activeSlotRef.current === 0) {
      advance(0);
    }
  }, [advance]);

  // Handle when Video 1 ends
  const handleEnded1 = useCallback(() => {
    if (activeSlotRef.current === 1) {
      advance(1);
    }
  }, [advance]);

  // Initial playback start for slot0
  useEffect(() => {
    const vid = videoRef0.current;
    if (vid && !getReducedMotion()) {
      const p = vid.play();
      if (p !== undefined) {
        p.catch(err => {
          const isAutoplay = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "AbortError");
          if (isAutoplay) setupAutoplayRecovery();
        });
      }
    }
  }, [setupAutoplayRecovery]);

  // Sync tab visibility and reduced motion
  useEffect(() => {
    const handleVisibility = () => {
      const activeVideo = activeSlotRef.current === 0 ? videoRef0.current : videoRef1.current;
      if (!activeVideo) return;
      if (document.hidden || getReducedMotion()) {
        activeVideo.pause();
      } else {
        activeVideo.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const playAnimation = useCallback((name: MascotAnimationName) => {
    if (getReducedMotion() || !isMascotAnimation(name) || MASCOT_ANIMATIONS[name].isPending) {
      return false;
    }
    requested.current = name;
    advance(activeSlotRef.current, name);
    return true;
  }, [advance]);

  useEffect(() => {
    function handleRequest(event: Event) {
      const request = (event as CustomEvent<MascotRequest>).detail;
      if (request && playAnimation(request.name)) request.onAccepted?.();
    }
    window.addEventListener(MASCOT_PLAY_EVENT, handleRequest);
    return () => window.removeEventListener(MASCOT_PLAY_EVENT, handleRequest);
  }, [playAnimation]);

  const activeVideoRef = activeSlot === 0 ? videoRef0 : videoRef1;
  const currentAnimation = activeSlot === 0 ? slot0.name : slot1.name;

  return {
    activeSlot,
    currentAnimation,
    videoRef: activeVideoRef,
    isLoaded,
    hasError,
    prefersReduced,
    slot0,
    slot1,
    videoRef0,
    videoRef1,
    handlePlaying0,
    handlePlaying1,
    handleEnded0,
    handleEnded1,
    handleLoadedData: () => setIsLoaded(true),
  };
}
