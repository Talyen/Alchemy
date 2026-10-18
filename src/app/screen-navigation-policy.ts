import { isRunResumeScreen, ROUTE_SCREENS, type Screen } from "@/lib/routing";

const RUN_SHELL_META_SCREENS: ReadonlySet<Screen> = new Set([
  ROUTE_SCREENS.COLLECTION,
  ROUTE_SCREENS.HOMESTEAD,
  ROUTE_SCREENS.TALENTS,
  ROUTE_SCREENS.ARMORY,
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

export function rememberNonOptionsScreen(renderedScreen: Screen, previous: Screen): Screen {
  return renderedScreen === ROUTE_SCREENS.OPTIONS ? previous : renderedScreen;
}

export interface OptionsReturnState {
  optionsReturnScreen: Screen;
  boardsFromOptions: boolean;
}

export function resolveNextOptionsReturnState(
  renderedScreen: Screen,
  prev: { prevScreen: Screen; optionsReturnScreen: Screen; boardsFromOptions: boolean },
): OptionsReturnState {
  const boardsFromOptions = renderedScreen === ROUTE_SCREENS.COLLECTION && prev.boardsFromOptions;
  const returningFromBoards = renderedScreen === ROUTE_SCREENS.OPTIONS && prev.boardsFromOptions;
  if (boardsFromOptions || returningFromBoards) {
    return { optionsReturnScreen: prev.optionsReturnScreen, boardsFromOptions };
  }
  return {
    optionsReturnScreen: rememberNonOptionsScreen(renderedScreen, prev.optionsReturnScreen),
    boardsFromOptions,
  };
}

export function resolveOptionsBackTarget(
  optionsReturnScreen: Screen,
  hasActiveBattle: boolean,
  hasResumableRun: boolean,
): { kind: "returnToRun" } | { kind: "goToScreen"; screen: Screen } {
  if (isRunResumeScreen(optionsReturnScreen)) {
    if (hasActiveBattle || hasResumableRun) return { kind: "returnToRun" };
    if (optionsReturnScreen !== ROUTE_SCREENS.DIFFICULTY_SELECT)
      return { kind: "goToScreen", screen: ROUTE_SCREENS.MENU };
  }
  return { kind: "goToScreen", screen: optionsReturnScreen };
}

export function resolveScreenBackHandler({
  renderedScreen,
  returnToRunTarget,
  returnToRun,
  handleMainMenu,
  backFromOptions,
  backFromDifficultySelect,
  goToScreen,
}: {
  renderedScreen: Screen;
  returnToRunTarget: Screen | null;
  returnToRun: () => void;
  handleMainMenu: () => void;
  backFromOptions: () => void;
  backFromDifficultySelect: () => void;
  goToScreen: (screen: Screen) => void;
}): (() => void) | undefined {
  if (renderedScreen === ROUTE_SCREENS.OPTIONS) return backFromOptions;
  if (RUN_SHELL_META_SCREENS.has(renderedScreen)) {
    return returnToRunTarget ? returnToRun : handleMainMenu;
  }
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
