import { isRunResumeScreen, ROUTE_SCREENS, type Screen } from "@/lib/routing";

const BROWSING_SCREENS: ReadonlySet<Screen> = new Set([
  ROUTE_SCREENS.COLLECTION,
  ROUTE_SCREENS.HOMESTEAD,
  ROUTE_SCREENS.TALENTS,
  ROUTE_SCREENS.ARMORY,
  ROUTE_SCREENS.OPTIONS,
]);

export function resolveReturnToRunTarget(
  returnToRunScreen: Screen | null,
  hasActiveBattle: boolean,
  hasResumableRun = false,
): Screen | null {
  if (returnToRunScreen) return returnToRunScreen;
  if (hasActiveBattle) return ROUTE_SCREENS.BATTLE;
  if (hasResumableRun) return ROUTE_SCREENS.DESTINATION;
  return null;
}

export function resolveBrowsingHistory(
  renderedScreen: Screen,
  prev: { prevScreen: Screen; history: readonly Screen[] },
): readonly Screen[] {
  if (renderedScreen === prev.prevScreen) return prev.history;
  if (!BROWSING_SCREENS.has(renderedScreen)) return [];
  // Returning to an ancestor consumes that visit, including menu shortcuts to
  // an already visited screen. This keeps repeated browsing from forming cycles.
  const ancestor = prev.history.lastIndexOf(renderedScreen);
  return ancestor >= 0 ? prev.history.slice(0, ancestor) : [...prev.history, prev.prevScreen];
}

export function resolveBrowsingBackTarget(
  origin: Screen,
  hasActiveBattle: boolean,
  hasResumableRun: boolean,
): { kind: "returnToRun" } | { kind: "goToScreen"; screen: Screen } {
  if (isRunResumeScreen(origin)) {
    if (hasActiveBattle || hasResumableRun) return { kind: "returnToRun" };
    if (origin !== ROUTE_SCREENS.DIFFICULTY_SELECT) return { kind: "goToScreen", screen: ROUTE_SCREENS.MENU };
  }
  return { kind: "goToScreen", screen: origin };
}

export function resolveScreenBackHandler({
  renderedScreen,
  handleMainMenu,
  backFromBrowsing,
  backFromDifficultySelect,
  goToScreen,
}: {
  renderedScreen: Screen;
  handleMainMenu: () => void;
  backFromBrowsing: () => void;
  backFromDifficultySelect: () => void;
  goToScreen: (screen: Screen) => void;
}): (() => void) | undefined {
  if (BROWSING_SCREENS.has(renderedScreen)) return backFromBrowsing;
  if (renderedScreen === ROUTE_SCREENS.GAME_MODE_SELECT) {
    return handleMainMenu;
  }
  if (renderedScreen === ROUTE_SCREENS.CHARACTER_SELECT) {
    return () => goToScreen(ROUTE_SCREENS.GAME_MODE_SELECT);
  }
  if (renderedScreen === ROUTE_SCREENS.DIFFICULTY_SELECT) {
    return backFromDifficultySelect;
  }
  return undefined;
}
