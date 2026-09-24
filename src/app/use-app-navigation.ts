import {
  rememberNonOptionsScreen,
  resolveOptionsBackTarget,
  resolveReturnToRunTarget,
  resolveScreenBackHandler,
} from "@/app/screen-navigation-policy";
import {
  useForegroundResumeKind,
  useHasActiveBattle,
  useRunResumeScreen,
} from "@/features/alchemy/shared/stores/run-reads";
import type { AlchemyRunCommands } from "@/features/alchemy/shell/route-commands";
import { useSequentialFadeSwap } from "@/features/alchemy/shared/ui/use-fade";
import { resolveGameDelay } from "@/lib/animation/game-timer";
import { MOTION_FADE_MS } from "@/lib/game-constants";
import type { Screen } from "@/lib/routing";
import { useCallback, useEffect, useState } from "react";

export function useGameMenuState() {
  const [gameMenuOpen, setGameMenuOpen] = useState(false);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);

  const openGameMenu = useCallback((rect?: DOMRect) => {
    setMenuAnchorRect(rect ?? null);
    setGameMenuOpen(true);
  }, []);

  const closeGameMenu = useCallback(() => {
    setGameMenuOpen(false);
    setMenuAnchorRect(null);
  }, []);

  const toggleGameMenu = useCallback(() => {
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
  run: Pick<AlchemyRunCommands, "goToScreen" | "returnToBattle">;
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
  const [navState, setNavState] = useState<{ prevScreen: Screen; optionsReturnScreen: Screen }>({
    prevScreen: renderedScreen,
    optionsReturnScreen: "menu",
  });
  let optionsReturnScreen = navState.optionsReturnScreen;
  if (renderedScreen !== navState.prevScreen) {
    const next = rememberNonOptionsScreen(renderedScreen, navState.optionsReturnScreen);
    optionsReturnScreen = next;
    setNavState({ prevScreen: renderedScreen, optionsReturnScreen: next });
  }

  const navigateToMeta = useCallback(
    (screen: Extract<Screen, "collection" | "talents" | "homestead" | "options" | "armory">) => {
      run.goToScreen(screen);
    },
    [run],
  );

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

  const screenBackHandler = resolveScreenBackHandler({
    renderedScreen,
    returnToRunTarget,
    returnToRun,
    handleMainMenu,
    backFromOptions,
    goToScreen: run.goToScreen,
  });

  return {
    returnToRunScreen,
    optionsReturnScreen,
    navigateToMeta,
    backFromOptions,
    returnToRun,
    handleMainMenu,
    returnToRunTarget,
    hasActiveBattle,
    screenBackHandler,
  };
}
