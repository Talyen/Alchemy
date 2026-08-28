export function isAnimationDisabled(): boolean {
  if (typeof localStorage !== "undefined") {
    return localStorage.getItem("alchemy-disable-animations") === "true";
  }
  return false;
}
export const ANIMATION_DISABLED_DURATION = 1;
