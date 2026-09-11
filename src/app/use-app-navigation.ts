import { ESCAPE_PRIORITY, pushEscapeHandler } from "@/app/escape-stack";
import { useLatestRef } from "@/features/alchemy/shared/hooks";
import { discoverCardIds, discoverTrinketIds, discoverUniqueIds } from "@/features/alchemy/shared/stores/profile-store";
import { clearAllPersistentGameData } from "@/features/alchemy/shared/stores/reset";
import {
  useForegroundResumeKind,
  useHasActiveBattle,
  useRunResumeScreen,
} from "@/features/alchemy/shared/stores/run-reads";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  setEncounteredEnemyIds,
  setFinishedRunCharacters,
  setMaterials,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { useSequentialFadeSwap } from "@/features/alchemy/shared/ui/use-fade";
import { isAlchemyDevBuild } from "@/features/alchemy/shared/utils";
import type { AlchemyRunCommands } from "@/features/alchemy/shell/route-commands";
import { resolveGameDelay } from "@/lib/animation/game-timer";
import { MOTION_FADE_MS, PAGE_EXIT_MS } from "@/lib/game-constants";
import { cardLibrary, enemyBestiary, trinketLibrary } from "@/lib/game-data";
import { uniqueItemList } from "@/lib/gear";
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
    durationMs: PAGE_EXIT_MS,
    initialPhase: "enter",
  });
  const [tooltipBlocked, setTooltipBlocked] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets transient tooltip suppression after screen changes
    setTooltipBlocked(true);
    const timer = window.setTimeout(() => setTooltipBlocked(false), resolveGameDelay(MOTION_FADE_MS));
    return () => window.clearTimeout(timer);
  }, [renderedScreen]);

  const pagePhase: "enter" | "exit" = fadePhase === "exit" ? "exit" : "enter";
  return { renderedScreen, pagePhase, tooltipBlocked };
}

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
): { kind: "returnToBattle" } | { kind: "goToScreen"; screen: Screen } {
  if (optionsReturnScreen !== "battle") {
    return { kind: "goToScreen", screen: optionsReturnScreen };
  }
  if (hasActiveBattle) return { kind: "returnToBattle" };
  return { kind: "goToScreen", screen: "destination" };
}

export function useReturnToRunNavigation({
  run,
  renderedScreen,
}: {
  run: Pick<AlchemyRunCommands, "goToScreen" | "returnToBattle">;
  renderedScreen: Screen;
}) {
  const returnToRunScreen = useRunResumeScreen();
  const [optionsReturnScreen, setOptionsReturnScreen] = useState<Screen>("menu");
  const hasActiveBattle = useHasActiveBattle();
  const resumeKind = useForegroundResumeKind();
  const returnToRunTarget = resolveReturnToRunTarget(
    returnToRunScreen,
    hasActiveBattle || resumeKind === "battle",
    resumeKind != null,
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- track the screen Options should restore
    setOptionsReturnScreen((prev) => rememberNonOptionsScreen(renderedScreen, prev));
  }, [renderedScreen]);

  function navigateToMeta(screen: Extract<Screen, "collection" | "talents" | "homestead" | "options" | "armory">) {
    run.goToScreen(screen);
  }

  function backFromOptions() {
    const target = resolveOptionsBackTarget(optionsReturnScreen, hasActiveBattle);
    if (target.kind === "returnToBattle") run.returnToBattle();
    else run.goToScreen(target.screen);
  }

  function returnToRun() {
    if (!returnToRunTarget) return;
    run.returnToBattle();
  }

  function handleMainMenu() {
    run.goToScreen("menu");
  }

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
  return undefined;
}

function isRadixEscapeTargetOpen(): boolean {
  return Boolean(
    document.querySelector(
      [
        '[data-radix-select-content][data-state="open"]',
        '[data-radix-dropdown-menu-content][data-state="open"]',
        '[data-radix-popover-content][data-state="open"]',
        '[data-radix-combobox-content][data-state="open"]',
      ].join(", "),
    ),
  );
}

export function useAppKeyboardShortcuts({
  renderedScreen,
  gameMenuOpen,
  onBack,
  toggleGameMenu,
}: {
  renderedScreen: Screen;
  gameMenuOpen: boolean;
  onBack?: (() => void) | undefined;
  toggleGameMenu: () => void;
}) {
  const gameMenuOpenRef = useLatestRef(gameMenuOpen);
  const renderedScreenRef = useLatestRef(renderedScreen);
  const onBackRef = useLatestRef(onBack);
  const toggleGameMenuRef = useLatestRef(toggleGameMenu);

  // Subscribed once; freshness comes from latest-refs above so menu/back/screen
  // updates never resubscribe the global Escape stack.
  useEffect(() => {
    const removeBackHandler = pushEscapeHandler({
      id: "app-screen-back",
      priority: ESCAPE_PRIORITY.SCREEN_OVERLAY,
      onEscape: () => {
        if (isRadixEscapeTargetOpen()) return false;
        if (gameMenuOpenRef.current) return false;
        if (onBackRef.current) {
          onBackRef.current();
          return;
        }
        return false;
      },
    });

    const removeMenuHandler = pushEscapeHandler({
      id: "app-game-menu",
      priority: ESCAPE_PRIORITY.APP_MENU,
      onEscape: () => {
        if (renderedScreenRef.current === "menu") return false;
        if (isRadixEscapeTargetOpen()) return false;
        toggleGameMenuRef.current();
        return;
      },
    });

    return () => {
      removeBackHandler();
      removeMenuHandler();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally subscribe once; refs stay fresh
  }, []);
}

export function useDevShortcuts(run: Pick<AlchemyRunCommands, "resetRunState" | "unlockAllTalents">) {
  const { resetRunState, unlockAllTalents } = run;
  const clearSaveData = useCallback(() => {
    void clearAllPersistentGameData().then((cleared) => {
      if (cleared) resetRunState();
    });
  }, [resetRunState]);

  const unlockAllDevMode = useCallback(() => {
    if (!isAlchemyDevBuild()) return;
    dispatchRunSessionCommand((draft) => {
      discoverCardIds(
        draft,
        cardLibrary.map((card) => card.id),
      );
      setEncounteredEnemyIds(
        draft,
        enemyBestiary.map((enemy) => enemy.id),
      );
      discoverTrinketIds(
        draft,
        trinketLibrary.map((boon) => boon.id),
      );
      discoverUniqueIds(
        draft,
        uniqueItemList.map((unique) => unique.id),
      );
      setFinishedRunCharacters(draft, ["knight", "rogue", "wizard", "ranger", "alchemist", "warlock", "druid"]);
      setMaterials(draft, { wood: 99, iron: 99, herbs: 99, food: 99, gems: 99 });
    });
    unlockAllTalents();
  }, [unlockAllTalents]);

  return { clearSaveData, unlockAllDevMode };
}
