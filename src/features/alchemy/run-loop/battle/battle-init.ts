// Battle start helpers: enemy selection, state creation, and encounter tracking.
import { createBattleState, getBattleStartPlayerHealth } from "@/lib/battle";
export { getBattleStartPlayerHealth };
import { getDifficultyModifiers, type BattleCard, type BestiaryEntry, type DifficultyModifier } from "@/lib/game-data";
import { mergeIntoManifest } from "@/lib/homestead/effects";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import { getBossById, getCurrentEnemy, getBossEnemy } from "@/features/alchemy/shared/config";
import { readBattleStore } from "../../shared/stores/run-session-facade";
import { useBattlePresentationStore } from "../../shared/stores/battle-presentation-store";
import { appendUnique } from "@/lib/utils";
import { useAppStore } from "../../shared/stores/app-store";
import { syncRunToBattleStart } from "../../shared/stores/run-transitions";
import type { RunStateController, TalentStateController } from "../../shared/stores/run-session-facade";

export type BattleInitDeps = {
  run: RunStateController;
  talents: TalentStateController;
  homesteadEffectsRef: React.MutableRefObject<HomesteadEffectManifest>;
  resetBattleSession: () => void;
  setCardTransfers: React.Dispatch<React.SetStateAction<import("@/features/alchemy/shared/types").CardTransfer[]>>;
  setHiddenHandCardKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  setCardTransferInProgress: React.Dispatch<React.SetStateAction<boolean>>;
};

export function createBattleInit(deps: BattleInitDeps) {
  const getStore = () => readBattleStore();
  const getPresentationStore = () => useBattlePresentationStore.getState();

  function createBattleForEnemy(
    enemy: BestiaryEntry,
    deck: BattleCard[],
    gold: number,
    playerHealth: number,
    roomsEncountered: number,
    modifiers?: DifficultyModifier[],
  ) {
    const mergedEffects = mergeIntoManifest(deps.talents.talentEffects, deps.homesteadEffectsRef.current);
    const activeModifiers =
      modifiers ??
      (deps.run.selectedDifficulty ? getDifficultyModifiers(deps.run.characterId, deps.run.selectedDifficulty) : []);
    return createBattleState({
      runDeck: deck,
      gold,
      totalRooms: roomsEncountered,
      currentEnemy: enemy,
      playerHealth,
      talentEffects: mergedEffects,
      discoveredCardIds: useAppStore.getState().discoveredCardIds,
      maxHealth: deps.run.runMaxHealth,
      trinketIds: deps.run.runTrinkets,
      difficultyModifiers: activeModifiers,
    });
  }

  function beginBattle(enemy: BestiaryEntry, deck: BattleCard[], gold: number, modifiers?: DifficultyModifier[]) {
    deps.resetBattleSession();
    deps.setCardTransfers([]);
    deps.setHiddenHandCardKeys(new Set());
    deps.setCardTransferInProgress(false);
    const startingHealth = syncRunToBattleStart();
    const nextRoomsEncountered = deps.run.roomsEncountered + 1;
    deps.run.setRoomsEncountered(nextRoomsEncountered);
    getPresentationStore().clearCardGhosts();
    const nextBattleState = createBattleForEnemy(enemy, deck, gold, startingHealth, nextRoomsEncountered, modifiers);
    getStore().setSyncedBattleState(nextBattleState);
    getStore().setBattleStartState(nextBattleState);
    getStore().setHasActiveBattle(true);
    deps.run.setEncounteredRunEnemyIds((current) => appendUnique(current, enemy.id));
    useAppStore.getState().setEncounteredEnemyIds((current) => appendUnique(current, enemy.id));
  }

  function startBattle(
    deck: BattleCard[] = deps.run.runDeck,
    gold: number = deps.run.runGold,
    enemyType: "normal" | "elite" = "normal",
    modifiers?: DifficultyModifier[],
  ) {
    beginBattle(getCurrentEnemy(enemyType, deps.run.encounteredRunEnemyIds), deck, gold, modifiers);
  }

  function startBossBattle(modifiers?: DifficultyModifier[]) {
    beginBattle(getBossEnemy(deps.run.encounteredRunEnemyIds), deps.run.runDeck, deps.run.runGold, modifiers);
  }

  function startBossById(bossId: string, modifiers?: DifficultyModifier[]): boolean {
    const boss = getBossById(bossId);
    if (!boss) {
      console.warn(`startBossById: boss "${bossId}" not found`);
      return false;
    }
    beginBattle(boss, deps.run.runDeck, deps.run.runGold, modifiers);
    return true;
  }

  return { startBattle, startBossBattle, startBossById };
}
