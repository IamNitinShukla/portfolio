/**
 * Centralized Animation Configuration for Portfolio Mascot (Red Robot)
 * 
 * Maps recognized animation clips to asset paths, playback modes, and availability.
 * Supported clips:
 *   - idle (one-shot)
 *   - wave (one-shot)
 *   - walk (one-shot)
 *   - jump (one-shot)
 *   - dance (one-shot)
 *   - sleep (one-shot)
 *   - celebrate (one-shot)
 *   - shrug (one-shot)
 *   - look-around (one-shot)
 */

export type MascotAnimationName =
  | "idle"
  | "wave"
  | "walk"
  | "jump"
  | "dance"
  | "sleep"
  | "celebrate"
  | "shrug"
  | "look-around";

export type MascotPlaybackType = "loop" | "one-shot";

export interface MascotAnimationItem {
  /** Unique animation identifier */
  name: MascotAnimationName;
  /** Relative web asset path under public directory */
  src: string;
  /** A one-shot plays through its natural end before the next selection. */
  playback: MascotPlaybackType;
  /** Human-readable label for debugging and accessibility */
  label: string;
  /**
   * Pending status: true if asset is planned but not yet provided.
   * Protects the controller from attempting to load non-existent files.
   */
  isPending: boolean;
}

export const MASCOT_ANIMATIONS: Record<MascotAnimationName, MascotAnimationItem> = {
  idle: {
    name: "idle",
    src: "/mascot/animations/idle.webm",
    playback: "one-shot",
    label: "Idle / Resting",
    isPending: false,
  },
  wave: {
    name: "wave",
    src: "/mascot/animations/wave.webm",
    playback: "one-shot",
    label: "Friendly Wave",
    isPending: false,
  },
  walk: {
    name: "walk",
    src: "/mascot/animations/walk.webm",
    playback: "one-shot",
    label: "Walking / Pacing",
    isPending: false,
  },
  jump: {
    name: "jump",
    src: "/mascot/animations/jump.webm",
    playback: "one-shot",
    label: "Happy Jump",
    isPending: false,
  },
  dance: {
    name: "dance",
    src: "/mascot/animations/dance.webm",
    playback: "one-shot",
    label: "Celebration Dance",
    isPending: false,
  },
  sleep: {
    name: "sleep",
    src: "/mascot/animations/sleep.webm",
    playback: "one-shot",
    label: "Sleeping / Snoozing",
    isPending: false,
  },
  celebrate: {
    name: "celebrate",
    src: "/mascot/animations/celebrate.webm",
    playback: "one-shot",
    label: "Victory Celebration",
    isPending: false,
  },
  shrug: {
    name: "shrug",
    src: "/mascot/animations/shrug.webm",
    playback: "one-shot",
    label: "Confused Shrug",
    isPending: false,
  },
  "look-around": {
    name: "look-around",
    src: "/mascot/animations/look-around.webm",
    playback: "one-shot",
    label: "Looking Around / Alert",
    isPending: false,
  },
};

export const DEFAULT_MASCOT_ANIMATION: MascotAnimationName = "idle";

/** Helper to test if a string is a valid recognized MascotAnimationName */
export function isMascotAnimation(name: string): name is MascotAnimationName {
  return Object.prototype.hasOwnProperty.call(MASCOT_ANIMATIONS, name);
}
