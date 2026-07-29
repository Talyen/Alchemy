import { useState } from "react";
import { resolveReturnToRunTarget, shouldClearReturnToRunOnMainMenu } from "@/app/return-to-run-navigation";
import { isRunLoopScreen, type Screen } from "@/lib/routing";
import { useHasActiveBattle } from "@/features/alchemy/shared/stores/run-session-facade";
import type { AlchemyRunCommands } from "@/features/alchemy/shell/use-alchemy-run-controller";

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
  const returnToRunTarget = resolveReturnToRunTarget(returnToRunScreen, hasActiveBattle);

  function navigateToMeta(screen: Extract<Screen, "collection" | "talents" | "homestead" | "options" | "armory">) {
    if (isRunLoopScreen(renderedScreen)) setReturnToRunScreen(renderedScreen);
    if (screen === "options") setOptionsReturnScreen(renderedScreen);
    run.goToScreen(screen);
  }

  function backFromOptions() {
    if (optionsReturnScreen === "battle") run.returnToBattle();
    else run.goToScreen(optionsReturnScreen);
  }

  function returnToRun() {
    const target = resolveReturnToRunTarget(returnToRunScreen, hasActiveBattle);
    if (!target) return;
    if (target === "battle") run.returnToBattle();
    else run.goToScreen(target);
    setReturnToRunScreen(null);
  }

  function handleMainMenu() {
    if (shouldClearReturnToRunOnMainMenu(hasActiveBattle)) {
      setReturnToRunScreen(null);
    }
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
