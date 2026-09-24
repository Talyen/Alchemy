import { isRunResumeScreen, type Screen } from "@/lib/routing";

export function resolveReturnToRunTarget(
  returnToRunScreen: Screen | null,
  hasActiveBattle: boolean,
  hasResumableRun = false,
): Screen | null {
  if (returnToRunScreen) return returnToRunScreen;
  if (hasActiveBattle) return "battle";
  if (hasResumableRun) return "destination";
  return null;
}

export function rememberNonOptionsScreen(renderedScreen: Screen, previous: Screen): Screen {
  return renderedScreen === "options" ? previous : renderedScreen;
}

export function resolveOptionsBackTarget(
  optionsReturnScreen: Screen,
  hasActiveBattle: boolean,
  hasResumableRun: boolean,
): { kind: "returnToRun" } | { kind: "goToScreen"; screen: Screen } {
  if (isRunResumeScreen(optionsReturnScreen)) {
    if (hasActiveBattle || hasResumableRun) return { kind: "returnToRun" };
    if (optionsReturnScreen !== "difficulty-select") return { kind: "goToScreen", screen: "menu" };
  }
  return { kind: "goToScreen", screen: optionsReturnScreen };
}

export function resolveScreenBackHandler({
  renderedScreen,
  returnToRunTarget,
  returnToRun,
  handleMainMenu,
  backFromOptions,
  goToScreen,
}: {
  renderedScreen: Screen;
  returnToRunTarget: Screen | null;
  returnToRun: () => void;
  handleMainMenu: () => void;
  backFromOptions: () => void;
  goToScreen: (screen: Screen) => void;
}): (() => void) | undefined {
  if (renderedScreen === "options") return backFromOptions;
  if (
    renderedScreen === "collection" ||
    renderedScreen === "homestead" ||
    renderedScreen === "talents" ||
    renderedScreen === "armory"
  ) {
    return returnToRunTarget ? returnToRun : handleMainMenu;
  }
  if (renderedScreen === "game-mode-select") {
    return handleMainMenu;
  }
  if (renderedScreen === "character-select") {
    return () => goToScreen("game-mode-select");
  }
  if (renderedScreen === "difficulty-select") {
    return () => goToScreen("character-select");
  }
  return undefined;
}
