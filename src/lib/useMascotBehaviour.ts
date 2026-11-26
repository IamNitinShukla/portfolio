"use client";

import { useCallback, useRef } from "react";
import { MASCOT_ANIMATIONS, type MascotAnimationName as Clip } from "@/config/mascotConfig";

const clips = {
  idle: { weight: 10, cooldownMs: 0 },
  "look-around": { weight: 25, cooldownMs: 25_000 },
  wave: { weight: 18, cooldownMs: 35_000 },
  walk: { weight: 15, cooldownMs: 40_000 },
  shrug: { weight: 12, cooldownMs: 40_000 },
  jump: { weight: 10, cooldownMs: 50_000 },
  celebrate: { weight: 8, cooldownMs: 75_000 },
  dance: { weight: 5, cooldownMs: 90_000 },
  sleep: { weight: 7, cooldownMs: 70_000 },
} satisfies Record<Clip, { weight: number; cooldownMs: number }>;

const names = Object.keys(clips) as Clip[];

export function useMascotBehaviour(random = Math.random) {
  const availableAt = useRef<Partial<Record<Clip, number>>>({});
  const failed = useRef(new Set<Clip>());

  const started = useCallback((name: Clip) => {
    availableAt.current[name] = performance.now() + clips[name].cooldownMs;
  }, []);

  const next = useCallback((previous: Clip, didFail: boolean, requested: Clip | null) => {
    if (didFail) failed.current.add(previous);
    const now = performance.now();
    const working = names.filter(name => !MASCOT_ANIMATIONS[name].isPending && !failed.current.has(name));
    const eligible = working.filter(name => (availableAt.current[name] ?? 0) <= now);
    const choices = eligible.length > 1 ? eligible.filter(name => name !== previous) : eligible;
    if (requested && choices.includes(requested)) return { name: requested };

    let draw = random() * choices.reduce((sum, name) => sum + clips[name].weight, 0);
    for (const name of choices) {
      draw -= clips[name].weight;
      if (draw < 0) return { name };
    }
    // Only possible after a failure: idle is normally always eligible.
    const earliest = Math.min(...working.map(name => availableAt.current[name] ?? now));
    return { retryAfter: earliest - now };
  }, [random]);

  return { started, next };
}
