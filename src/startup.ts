import { isAnimationDisabled } from "@/lib/animation/animation-prefs";

export function applyInitialAnimationPreference(): void {
  try {
    if (isAnimationDisabled()) {
      document.documentElement.classList.add("alchemy-disable-animations");
    }
  } catch (error) {
    console.warn("Failed to apply initial local storage styles", error);
  }
}

applyInitialAnimationPreference();
