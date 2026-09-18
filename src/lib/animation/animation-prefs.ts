export function isAnimationDisabled(): boolean {
  if (typeof localStorage !== "undefined") {
    return localStorage.getItem("alchemy-disable-animations") === "true";
  }
  return false;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
