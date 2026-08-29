import { useCallback, useEffect, useState } from "react";
import type { Screen } from "@/lib/routing";
import { isRunLoopScreen } from "@/lib/routing";
import { resolveGameDelay } from "@/lib/animation/game-timer";
import { MOTION_FADE_MS, PAGE_EXIT_MS } from "@/lib/game-constants";
import { ESCAPE_PRIORITY, pushEscapeHandler } from "@/app/escape-stack";
import {
  useHasActiveBattle,
  useHasActiveRun,
  useForegroundResumeKind,
} from "@/features/alchemy/shared/stores/run-reads";
import { useLatestRef } from "@/features/alchemy/shared/hooks";
import { useSequentialFadeSwap } from "@/features/alchemy/shared/ui/use-sequential-fade-swap";
import type { AlchemyRunCommands } from "@/features/alchemy/shell/use-alchemy-run-controller";
import { cardLibrary, enemyBestiary, trinketLibrary } from "@/lib/game-data";
import { uniqueItemList } from "@/lib/gear";
import {
  discoverCardIds,
  discoverTrinketIds,
  discoverUniqueIds,
  setEncounteredEnemyIds,
  setFinishedRunCharacters,
} from "@/features/alchemy/shared/stores/profile-store";
import { setMaterials } from "@/features/alchemy/shared/stores/run-session-write-port";
import { clearAllPersistentGameData } from "@/features/alchemy/shared/stores/reset";
import { isAlchemyDevBuild } from "@/features/alchemy/shared/utils";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";

export function useGameMenuState() {
  const [gameMenuOpen, setGameMenuOpen] = useState(false);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);

  const openBattleMenu = useCallback((rect?: DOMRect) => {
    setMenuAnchorRect(rect ?? null);
    setGameMenuOpen(true);
  }, []);

  const closeGameMenu = useCallback(() => {
    setGameMenuOpen(false);
    setMenuAnchorRect(null);
  }, []);

  return { gameMenuOpen, menuAnchorRect, openBattleMenu, closeGameMenu, setMenuAnchorRect, setGameMenuOpen };
}

export function useRenderedScreenTransition(controllerScreen: Screen, commitPendingTransition: () => void) {
  const { shown: renderedScreen, phase: fadePhase } = useSequentialFadeSwap({
    target: controllerScreen,
    durationMs: PAGE_EXIT_MS,
    initialPhase: "enter",
    onSwap: commitPendingTransition,
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
  const [returnToRunScreen, setReturnToRunScreen] = useState<Screen | null>(null);
  const [optionsReturnScreen, setOptionsReturnScreen] = useState<Screen>("menu");
  const hasActiveBattle = useHasActiveBattle();
  const hasActiveRun = useHasActiveRun();
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
    if (isRunLoopScreen(renderedScreen)) setReturnToRunScreen(renderedScreen);
    run.goToScreen(screen);
  }

  function backFromOptions() {
    const target = resolveOptionsBackTarget(optionsReturnScreen, hasActiveBattle);
    if (target.kind === "returnToBattle") run.returnToBattle();
    else run.goToScreen(target.screen);
  }

  function returnToRun() {
    const target = resolveReturnToRunTarget(
      returnToRunScreen,
      hasActiveBattle || resumeKind === "battle",
      resumeKind != null,
    );
    if (!target) return;
    if (hasActiveRun && returnToRunScreen && returnToRunScreen !== "battle") {
      run.goToScreen(returnToRunScreen);
    } else {
      run.returnToBattle();
    }
    setReturnToRunScreen(null);
  }

  function handleMainMenu() {
    if (isRunLoopScreen(renderedScreen)) setReturnToRunScreen(renderedScreen);
    run.goToScreen("menu");
  }

  return {
    returnToRunScreen,
    optionsReturnScreen,
    navigateToMeta,
    backFromOptions,
    returnToRun,
    handleMainMenu,
    returnToRunTarget,
    hasActiveBattle,
  };
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
  setMenuAnchorRect,
  setGameMenuOpen,
}: {
  renderedScreen: Screen;
  gameMenuOpen: boolean;
  setMenuAnchorRect: (rect: DOMRect | null | ((prev: DOMRect | null) => DOMRect | null)) => void;
  setGameMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
}) {
  const gameMenuOpenRef = useLatestRef(gameMenuOpen);
  const renderedScreenRef = useLatestRef(renderedScreen);

  useEffect(() => {
    return pushEscapeHandler({
      id: "app-game-menu",
      priority: ESCAPE_PRIORITY.APP_MENU,
      onEscape: () => {
        if (renderedScreenRef.current === "menu") return false;
        if (isRadixEscapeTargetOpen()) return false;
        if (!gameMenuOpenRef.current) setMenuAnchorRect(null);
        setGameMenuOpen((prev) => !prev);
        return;
      },
    });
  }, [gameMenuOpenRef, renderedScreenRef, setMenuAnchorRect, setGameMenuOpen]);
}

export function useDevShortcuts(run: Pick<AlchemyRunCommands, "resetRunState" | "unlockAllTalents">) {
  const clearSaveData = useCallback(() => {
    void clearAllPersistentGameData().then((cleared) => {
      if (cleared) run.resetRunState();
    });
  }, [run]);

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
      setMaterials(draft, { wood: 99, iron: 99, herbs: 99, food: 99, crystal: 99 });
    });
    run.unlockAllTalents();
  }, [run]);

  return { clearSaveData, unlockAllDevMode };
}
