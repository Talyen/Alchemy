import type { Screen } from "@/lib/routing";

export function resolveReturnToRunTarget(returnToRunScreen: Screen | null, hasActiveBattle: boolean): Screen | null {
  return returnToRunScreen ?? (hasActiveBattle ? "battle" : null);
}

export function resolveReturnToRunLabel(target: Screen): "Return to Battle" | "Return to Run" {
  return target === "battle" ? "Return to Battle" : "Return to Run";
}

export function shouldShowReturnToRun(target: Screen | null, currentScreen: Screen): boolean {
  return target !== null && target !== currentScreen;
}

export function shouldClearReturnToRunOnMainMenu(hasActiveBattle: boolean): boolean {
  return !hasActiveBattle;
}
