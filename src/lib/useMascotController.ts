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
  window.dispatchEvent(new CustomEvent<MascotRequest>(MASCOT_PLAY_EVENT, {
    detail: { name, onAccepted: () => { accepted = true; } },
  }));
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
  // A new turn can replay the same source when all other clips are cooling down.
  const [turn, setTurn] = useState(() => ({
    name: isMascotAnimation(initialAnimation) && !MASCOT_ANIMATIONS[initialAnimation].isPending
      ? initialAnimation : DEFAULT_MASCOT_ANIMATION,
  }));
  const videoRef = useRef<HTMLVideoElement>(null);
  const startedTurn = useRef<typeof turn | null>(null);
  const endedTurn = useRef<typeof turn | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const requested = useRef<MascotAnimationName | null>(null);
  const { started, next } = useMascotBehaviour();
  const prefersReduced = useSyncExternalStore(subscribeToReducedMotion, getReducedMotion, getServerReducedMotion);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || prefersReduced === null || hasError) return;
    let disposed = false;
    let advancing = false;
    let failed = Boolean(video.error);
    let retry: number | undefined;
    let playAttempt = 0;

    function advance() {
      if (disposed || advancing || document.hidden || getReducedMotion()) return;
      const choice = next(turn.name, failed, requested.current);
      if (choice.name) {
        advancing = true;
        requested.current = null;
        setTurn({ name: choice.name });
      } else if (Number.isFinite(choice.retryAfter)) {
        if (retry === undefined) {
          retry = window.setTimeout(() => { retry = undefined; advance(); }, choice.retryAfter);
        }
      } else {
        setHasError(true);
      }
    }

    function onFailure() {
      failed = true;
      advance();
    }

    function onEnded() {
      endedTurn.current = turn;
      advance();
    }

    function syncPlayback() {
      const attempt = ++playAttempt;
      if (document.hidden || getReducedMotion()) {
        video!.pause();
      } else if (failed || endedTurn.current === turn) {
        advance();
      } else {
        void video!.play().catch(() => {
          if (!disposed && attempt === playAttempt) onFailure();
        });
      }
    }

    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onFailure);
    document.addEventListener("visibilitychange", syncPlayback);
    syncPlayback();
    return () => {
      disposed = true;
      window.clearTimeout(retry);
      document.removeEventListener("visibilitychange", syncPlayback);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onFailure);
    };
  }, [turn, prefersReduced, hasError, next]);

  const playAnimation = useCallback((name: MascotAnimationName) => {
    if (!videoRef.current || requested.current || getReducedMotion() || !isMascotAnimation(name)
      || MASCOT_ANIMATIONS[name].isPending) return false;
    requested.current = name;
    return true;
  }, []);

  useEffect(() => {
    function handleRequest(event: Event) {
      const request = (event as CustomEvent<MascotRequest>).detail;
      if (request && playAnimation(request.name)) request.onAccepted?.();
    }
    window.addEventListener(MASCOT_PLAY_EVENT, handleRequest);
    const debugWindow = window as Window & {
      __mascotController?: { play: typeof playAnimation; reset: () => boolean };
    };
    const controls = { play: playAnimation, reset: () => playAnimation(DEFAULT_MASCOT_ANIMATION) };
    if (process.env.NODE_ENV === "development") debugWindow.__mascotController = controls;
    return () => {
      window.removeEventListener(MASCOT_PLAY_EVENT, handleRequest);
      if (debugWindow.__mascotController === controls) delete debugWindow.__mascotController;
    };
  }, [playAnimation]);

  return {
    currentAnimation: turn.name,
    videoRef,
    isLoaded,
    hasError,
    prefersReduced,
    videoProps: {
      src: MASCOT_ANIMATIONS[turn.name].src,
      autoPlay: prefersReduced === false,
      muted: true,
      loop: MASCOT_ANIMATIONS[turn.name].playback === "loop",
      playsInline: true,
      onLoadedData: () => setIsLoaded(true),
      onPlaying: () => {
        if (startedTurn.current !== turn) {
          startedTurn.current = turn;
          started(turn.name);
        }
      },
    },
  };
}
