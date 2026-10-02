import { tryLocalStorageGetItem } from "@/lib/storage-environment";

export function isAnimationDisabled(): boolean {
  const result = tryLocalStorageGetItem("alchemy-disable-animations");
  return result.ok && result.value === "true";
}

let reducedMotionQuery: MediaQueryList | undefined;
let reducedMotionWindow: Window | undefined;
let reducedMotionMatchMedia: Window["matchMedia"] | undefined;

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  // MediaQueryList.matches stays live as the OS preference changes. Cache the
  // query object, not its result, since animation loops read this every frame.
  if (!reducedMotionQuery || reducedMotionWindow !== window || reducedMotionMatchMedia !== window.matchMedia) {
    reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionWindow = window;
    reducedMotionMatchMedia = window.matchMedia;
  }
  return reducedMotionQuery.matches;
}

export function shouldReduceMotion(): boolean {
  return isAnimationDisabled() || prefersReducedMotion();
}

// React entry point: useReducedMotionPreference() in
// src/components/ui/use-reduced-motion-preference.ts (it lives beside the UI
// primitives because src/lib must stay React-free). New motion-gated UI
// should use that hook so the disable flag and OS setting stay in one place.
// The remaining Motion `useReducedMotion` call sites (armory, combat text)
// predate the flag and are intentionally left until their visuals are
// re-verified with the flag honored.
export const ANIMATION_DISABLED_DURATION = 1;
