import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import {
  applyRunDefeatTeardown,
  clearBattlePresentationUi,
} from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import {
  addMaterials,
  clearRunMaterialsEarned,
  finalizeRunXP,
  setHasActiveBattle,
  setRunEndMaterials,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { resolveGameDelay } from "@/lib/animation/game-timer";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { BATTLE_END_TRANSITION_DELAY } from "@/lib/game-constants";
import { addInventory, emptyInventory } from "@/lib/homestead/inventory";
import { applyEndOfRunHomesteadBonuses } from "@/lib/homestead/loot";
import { ROUTE_SCREENS } from "@/lib/routing";
import type { RunOutcomeDeps } from "./run-flow";

export function clearCombatState(draft: GameplayDraft) {
  setHasActiveBattle(draft, false);
}

function clearCombatPresentation() {
  clearBattlePresentationUi();
}

export function awardRunEndMaterials(draft: GameplayDraft): ReturnType<typeof emptyInventory> {
  const runState = draft.run.activeRun;
  const runProfile = draft.runProfile;
  if (runState.contentSystemType === CONTENT_SYSTEMS.WILDWOOD) {
    clearRunMaterialsEarned(draft);
    const none = emptyInventory();
    setRunEndMaterials(draft, none);
    return none;
  }
  const runCollected = runState.runMaterialsEarned;
  const homesteadBonus = applyEndOfRunHomesteadBonuses(emptyInventory(), runProfile.effects, runState.roomsEncountered);
  addMaterials(draft, homesteadBonus);
  setRunEndMaterials(draft, addInventory(runCollected, homesteadBonus));
  clearRunMaterialsEarned(draft);
  return homesteadBonus;
}

export function createDefeatHandlers(deps: RunOutcomeDeps) {
  function finalizeDefeat() {
    applyRunDefeatTeardown({
      awardRunEndMaterials,
      finalizeRunXP,
      clearCombatState,
      clearCombatPresentation,
    });
  }

  function endRunAndShowGameOver() {
    finalizeDefeat();
    deps.actions.transition(ROUTE_SCREENS.GAME_OVER, { immediate: true });
  }

  function handleBattleDefeat() {
    deps.actions.transition(ROUTE_SCREENS.GAME_OVER, {
      delayMs: resolveGameDelay(BATTLE_END_TRANSITION_DELAY),
      guard: () => readRunSession().hasActiveRun,
      prepare: finalizeDefeat,
    });
  }

  function isLabyrinthRun() {
    return readActiveRun().contentSystemType === CONTENT_SYSTEMS.LABYRINTH;
  }

  function endLabyrinthRun() {
    if (!isLabyrinthRun()) return;
    endRunAndShowGameOver();
  }

  function handleAbandonRun() {
    deps.actions.clearCardHover();
    endRunAndShowGameOver();
  }

  return {
    endRunAndShowGameOver,
    handleBattleDefeat,
    handleAbandonRun,
    endLabyrinthRun,
  };
}
