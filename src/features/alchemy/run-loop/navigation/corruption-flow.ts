import { readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { readActivityData } from "@/lib/active-run-session";
import { playUISound } from "@/lib/audio";
import { corruptRunCard } from "./corruption-commands";
export interface CorruptionFlowDeps {
  advanceToNextDestination: () => void;
  returnToCurrentDestination: () => void;
  returnToLabyrinthMap?: () => void;
  isLabyrinthRun?: () => boolean;
}

export function createCorruptionFlowHandlers(deps: CorruptionFlowDeps) {
  function handleCorruptCard(cardIndex: number) {
    const activity = readRunSession().activity;
    if (activity.kind !== "corruption" || readActivityData(activity, "corruption")) return;
    if (corruptRunCard(cardIndex)) playUISound("musicBoxMystery");
  }

  function handleCorruptionExit() {
    if (readActivityData(readRunSession().activity, "corruption")) {
      deps.advanceToNextDestination();
      return;
    }
    if (deps.isLabyrinthRun?.() && deps.returnToLabyrinthMap) {
      deps.returnToLabyrinthMap();
      return;
    }
    deps.returnToCurrentDestination();
  }

  return { handleCorruptCard, handleCorruptionExit };
}
