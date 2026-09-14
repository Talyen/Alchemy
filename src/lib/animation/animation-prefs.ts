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

export const ANIMATION_DISABLED_DURATION = 1;
