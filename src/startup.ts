import { isAnimationDisabled } from "@/lib/animation/animation-prefs";

export function applyInitialAnimationPreference(): void {
  try {
    if (typeof document !== "undefined" && document.documentElement) {
      if (isAnimationDisabled()) {
        document.documentElement.classList.add("alchemy-disable-animations");
      } else {
        document.documentElement.classList.remove("alchemy-disable-animations");
      }
    }
  } catch (error) {
    console.warn("Failed to apply initial local storage styles", error);
  }
}

applyInitialAnimationPreference();
