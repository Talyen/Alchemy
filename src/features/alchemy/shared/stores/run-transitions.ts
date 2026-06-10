// Atomic run lifecycle transitions over the consolidated domain store.
import { getBattleStartPlayerHealth } from "@/lib/battle";
import { playDefeat, stopAllSfx } from "@/lib/audio";
import { buildActiveRunSnapshot, type ActiveRunData } from "@/lib/active-run-session";
import type { Screen } from "@/lib/routing";
import type { UnlockedTalents, TalentXP } from "@/lib/game-data";
import { flushAlchemySaveNow } from "@/features/alchemy/shared/storage";
import type { Destination } from "@/features/alchemy/shared/types";
import type { MaterialInventory } from "@/lib/homestead/types";
import { createEmptyRewardState } from "@/features/alchemy/run-loop/navigation/reward-flow";
import { getRunDomainStore, useRunDomainStore } from "./run-domain-store";
import { createInitialRunDomainData } from "./run-domain-types";
import { useBattlePresentationStore } from "./battle-presentation-store";
import { useUiStore } from "./ui-store";
import { useAppStore } from "./app-store";
import { getRunSession } from "./run-session-model";

/** Apply persisted active-run data to the domain store atomically. */
export function restoreRun(
  activeRun: ActiveRunData | null,
  talentXP: TalentXP,
  unlockedTalents: UnlockedTalents,
): void {
  const store = getRunDomainStore();
  store.initializeProgress(activeRun, talentXP, unlockedTalents);
  store.initializeActiveBattle(activeRun?.activeCombat?.battleState ?? null);

  if (activeRun?.currentScreen) {
    store.setScreen(activeRun.currentScreen as Screen);
  }

  if (!activeRun) {
    return;
  }

  store.setHasActiveRun(true);

  if (activeRun.labyrinthMap) {
    store.setLabyrinthMap(activeRun.labyrinthMap);
  }

  if (activeRun.activeCombat) {
    store.setActiveLabyrinthModifiers(activeRun.activeCombat.activeLabyrinthModifiers);
    store.setActiveLabyrinthRewardModifiers(activeRun.activeCombat.activeLabyrinthRewardModifiers);
  }

  if (activeRun.labyrinthPendingNode) {
    store.setActiveLabyrinthPendingNode(activeRun.labyrinthPendingNode);
  }

  if (activeRun.currentScreen === "destination" && activeRun.destinationChoices.length > 0) {
    store.setRewardState({
      ...createEmptyRewardState(),
      destinations: activeRun.destinationChoices as Destination[],
    });
  }
}

/** Active-run snapshot for autosave — null when the run has ended. */
export function resolveActiveRunForSave(hasActiveRun: boolean, screen?: Screen): ActiveRunData | null {
  return hasActiveRun ? snapshotRun(screen) : null;
}

/** Serialize domain store into persisted ActiveRunData. */
export function snapshotRun(screen?: Screen): ActiveRunData {
  const { run, session, battle } = getRunSession(screen);
  return buildActiveRunSnapshot({
    characterId: run.characterId,
    runDeck: run.runDeck,
    runGold: run.runGold,
    runPlayerHealth: run.runPlayerHealth,
    runMaxHealth: run.runMaxHealth,
    roomsEncountered: run.roomsEncountered,
    currentAct: run.currentAct,
    destinationIndexInAct: run.destinationIndexInAct,
    completedDestinations: run.completedDestinations,
    runTrinkets: run.runTrinkets,
    encounteredRunEnemyIds: run.encounteredRunEnemyIds,
    selectedDifficulty: run.selectedDifficulty,
    contentSystemType: run.contentSystemType,
    labyrinthMap: session.labyrinthMap,
    hasActiveBattle: battle.hasActiveBattle,
    battleState: battle.battleState,
    labyrinthPendingNode: session.activeLabyrinthPendingNode,
    activeLabyrinthModifiers: session.activeLabyrinthModifiers,
    activeLabyrinthRewardModifiers: session.activeLabyrinthRewardModifiers,
    runTalentXP: run.runTalentXP,
    currentScreen: screen ?? getRunDomainStore().navigation.screen,
    destinationChoices: session.rewardState.destinations,
  });
}

/** Clamp run HP for battle entry and persist before creating BattleState. */
export function syncRunToBattleStart(playerHealth?: number): number {
  const store = getRunDomainStore();
  const startingHealth =
    playerHealth ??
    getBattleStartPlayerHealth(store.progress.runPlayerHealth, store.progress.runMaxHealth, store.progress.runTrinkets);
  store.setRunPlayerHealth(startingHealth);
  return startingHealth;
}

/** Persist combat HP to run progress after victory or when leaving battle. */
export function syncBattleToRun(options?: { playerHealth?: number }): void {
  const store = getRunDomainStore();
  const health = options?.playerHealth ?? store.battle.battleState.playerHealth;
  store.setRunPlayerHealth(health);
}

/** Clear active combat, run progression, session UI, navigation, and presentation. */
export function teardownRun(): void {
  useRunDomainStore.setState((state) => {
    const characterId = state.progress.characterId;
    const talentXP = state.progress.talentXP;
    const unlockedTalents = state.progress.unlockedTalents;
    const fresh = createInitialRunDomainData();
    state.progress = {
      ...fresh.progress,
      characterId,
      talentXP,
      unlockedTalents,
      initialized: true,
    };
    state.session = { ...fresh.session, pendingContentSystemType: "campaign" };
    state.navigation = fresh.navigation;
    state.battle = fresh.battle;
  });
  useBattlePresentationStore.getState().resetPresentation();
  useUiStore.getState().clearCardHover();
}

/** Write the full save file immediately (bypasses autosave debounce). */
export async function flushPersistedSave(activeRun: ActiveRunData | null): Promise<void> {
  await flushAlchemySaveNow(activeRun);
}

/** Persist meta/talent progress after a run ends with no resumable active run. */
export function flushSaveAfterRunEnd(): void {
  void flushPersistedSave(null);
}

/** Shared run-end bookkeeping: materials, XP, save flush, and clear active-run flag. */
export function finalizeRunEndSession(options: {
  awardRunEndMaterials: (displayMaterials?: MaterialInventory | null) => MaterialInventory;
  finalizeRunXP: () => void;
  displayMaterials?: MaterialInventory | null;
}): MaterialInventory {
  const activeChar = useRunDomainStore.getState().progress.characterId;
  useAppStore.getState().setFinishedRunCharacters((prev) => {
    if (prev.includes(activeChar)) return prev;
    return [...prev, activeChar];
  });

  const materials = options.awardRunEndMaterials(options.displayMaterials);
  options.finalizeRunXP();
  flushSaveAfterRunEnd();
  getRunDomainStore().setHasActiveRun(false);
  return materials;
}

/** Defeat flow: finalize rewards/XP, persist, audio, and clear combat state. */
export function applyRunDefeatTeardown(options: {
  awardRunEndMaterials: () => void;
  finalizeRunXP: () => void;
  clearCombatState: () => void;
}): void {
  finalizeRunEndSession({
    awardRunEndMaterials: () => options.awardRunEndMaterials(),
    finalizeRunXP: options.finalizeRunXP,
  });
  stopAllSfx();
  playDefeat();
  options.clearCombatState();
}
