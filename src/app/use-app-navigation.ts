import { defaultGameSession } from "@/app/application-session";
import { getDesktopApi } from "@/lib/desktop-api";
import {
  rememberNonOptionsScreen,
  resolveOptionsBackTarget,
  resolveReturnToRunTarget,
  resolveScreenBackHandler,
} from "@/app/screen-navigation-policy";
import { readActiveRunScreen } from "@/features/alchemy/shared/stores/run-reads";
import {
  useForegroundResumeKind,
  useHasActiveBattle,
  useRunResumeScreen,
} from "@/features/alchemy/shared/stores/use-run-reads";
import type { AlchemyRunCommands } from "@/features/alchemy/shell/route-commands";
import { useSequentialFadeSwap } from "@/features/alchemy/shared/ui/use-fade";
import { resolveGameDelay } from "@/lib/animation/game-timer";
import { MOTION_FADE_MS } from "@/lib/game-constants";
import type { Screen } from "@/lib/routing";
import { useCallback, useEffect, useState } from "react";
import { playUISound } from "@/lib/audio";

export function useGameMenuState() {
  const [gameMenuOpen, setGameMenuOpen] = useState(false);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);

  const openGameMenu = useCallback((rect?: DOMRect) => {
    playUISound("pause");
    setMenuAnchorRect(rect ?? null);
    setGameMenuOpen(true);
  }, []);

  useEffect(() => {
    // A captured trigger rect becomes stale after resizing. Keep the menu open
    // (and combat paused), using its existing centered presentation instead.
    const clearAnchor = () => setMenuAnchorRect(null);
    window.addEventListener("resize", clearAnchor);
    return () => window.removeEventListener("resize", clearAnchor);
  }, []);

  useEffect(
    () =>
      getDesktopApi()?.onExternalFocusLost?.(() => {
        if (readActiveRunScreen(defaultGameSession) === "battle") openGameMenu();
      }),
    [openGameMenu],
  );

  const closeGameMenu = useCallback(() => {
    playUISound("pause");
    setGameMenuOpen(false);
    setMenuAnchorRect(null);
  }, []);

  const toggleGameMenu = useCallback(() => {
    playUISound("pause");
    // Keyboard-driven toggle has no anchor element, so it always clears any
    // stale anchor: a null anchor renders the menu unanchored (centered),
    // which is the correct keyboard-opened state, and keeps closed anchor-free.
    setMenuAnchorRect(null);
    setGameMenuOpen((prev) => !prev);
  }, []);

  return { gameMenuOpen, menuAnchorRect, openGameMenu, closeGameMenu, toggleGameMenu };
}

export function useRenderedScreenTransition(controllerScreen: Screen) {
  const { shown: renderedScreen, phase: fadePhase } = useSequentialFadeSwap({
    target: controllerScreen,
    durationMs: MOTION_FADE_MS,
    initialPhase: "enter",
  });
  const [unblockedScreen, setUnblockedScreen] = useState<Screen>(controllerScreen);

  useEffect(() => {
    const timer = window.setTimeout(() => setUnblockedScreen(renderedScreen), resolveGameDelay(MOTION_FADE_MS));
    return () => window.clearTimeout(timer);
  }, [renderedScreen]);

  const tooltipBlocked = renderedScreen !== unblockedScreen;
  const pagePhase: "enter" | "exit" = fadePhase === "exit" ? "exit" : "enter";
  return { renderedScreen, pagePhase, tooltipBlocked };
}

export function useReturnToRunNavigation({
  run,
  renderedScreen,
}: {
  run: Pick<AlchemyRunCommands, "goToScreen" | "returnToBattle" | "routeCommands">;
  renderedScreen: Screen;
}) {
  const returnToRunScreen = useRunResumeScreen();
  const hasActiveBattle = useHasActiveBattle();
  const resumeKind = useForegroundResumeKind();
  const returnToRunTarget = resolveReturnToRunTarget(
    returnToRunScreen,
    hasActiveBattle || resumeKind === "battle",
    resumeKind != null,
  );
  const [navState, setNavState] = useState<{
    prevScreen: Screen;
    optionsReturnScreen: Screen;
    boardsFromOptions: boolean;
  }>({
    prevScreen: renderedScreen,
    optionsReturnScreen: "menu",
    boardsFromOptions: false,
  });
  let optionsReturnScreen = navState.optionsReturnScreen;
  let boardsFromOptions = navState.boardsFromOptions;
  if (renderedScreen !== navState.prevScreen) {
    boardsFromOptions = renderedScreen === "collection" && navState.boardsFromOptions;
    const returningFromBoards = renderedScreen === "options" && navState.boardsFromOptions;
    const next =
      boardsFromOptions || returningFromBoards
        ? navState.optionsReturnScreen
        : rememberNonOptionsScreen(renderedScreen, navState.optionsReturnScreen);
    optionsReturnScreen = next;
    setNavState({ prevScreen: renderedScreen, optionsReturnScreen: next, boardsFromOptions });
  }

  const navigateToMeta = useCallback(
    (screen: Extract<Screen, "collection" | "talents" | "homestead" | "options" | "armory">) => {
      run.goToScreen(screen);
    },
    [run],
  );

  const openBoardsFromOptions = useCallback(() => {
    setNavState((current) => ({ ...current, boardsFromOptions: true }));
    run.routeCommands.meta.selectCollectionTab("boards");
    run.goToScreen("collection");
  }, [run]);

  const backFromOptions = useCallback(() => {
    const target = resolveOptionsBackTarget(optionsReturnScreen, hasActiveBattle, resumeKind != null);
    if (target.kind === "returnToRun") run.returnToBattle();
    else run.goToScreen(target.screen);
  }, [optionsReturnScreen, hasActiveBattle, resumeKind, run]);

  const returnToRun = useCallback(() => {
    if (!returnToRunTarget) return;
    run.returnToBattle();
  }, [returnToRunTarget, run]);

  const handleMainMenu = useCallback(() => {
    run.goToScreen("menu");
  }, [run]);

  const defaultScreenBackHandler = resolveScreenBackHandler({
    renderedScreen,
    returnToRunTarget,
    returnToRun,
    handleMainMenu,
    backFromOptions,
    backFromDifficultySelect: run.routeCommands.runSetup.handleBackFromDifficultySelect,
    goToScreen: run.goToScreen,
  });

  const screenBackHandler =
    renderedScreen === "collection" && boardsFromOptions ? () => run.goToScreen("options") : defaultScreenBackHandler;
  return {
    returnToRunScreen,
    optionsReturnScreen,
    navigateToMeta,
    openBoardsFromOptions,
    backFromOptions,
    returnToRun,
    handleMainMenu,
    returnToRunTarget,
    hasActiveBattle,
    screenBackHandler,
  };
}
