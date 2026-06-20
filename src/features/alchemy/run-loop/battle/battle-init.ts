// Battle start helpers: enemy selection, state creation, and encounter tracking.
import { createBattleState, getBattleStartPlayerHealth } from "@/lib/battle";
export { getBattleStartPlayerHealth };
import { getDifficultyModifiers, type BattleCard, type BestiaryEntry, type DifficultyModifier } from "@/lib/game-data";
import type { RunStateController, TalentStateController } from "../../shared/stores/run-session-facade";
import { mergeIntoManifest } from "@/lib/homestead/effects";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import { getBossById, getCurrentEnemy, getBossEnemy } from "@/features/alchemy/shared/config";
import { readBattleStore, readRunSessionStore } from "../../shared/stores/run-session-facade";
import { useBattlePresentationStore } from "../../shared/stores/battle-presentation-store";
import { appendUnique } from "@/lib/utils";
import { useAppStore } from "../../shared/stores/app-store";
import { syncRunToBattleStart } from "../../shared/stores/run-transitions";
import { withWildwoodModifier, type WildwoodModifierId } from "@/lib/content-systems/wildwood/gauntlet";
import { appendEncounterTraits, type EncounterCombatTraitId } from "@/lib/content-systems/encounter-traits";
import { computeGearManifest, flattenGearInventories } from "@/lib/gear";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";
import type { RefObject } from "react";

export function createBattleInit(params: {
  resetBattleSession: () => void;
  run: RunStateController;
  talents: TalentStateController;
  homesteadEffectsRef: RefObject<HomesteadEffectManifest>;
}) {
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
    const gear = useGearStore.getState();
    const gearEffects = computeGearManifest(
      params.run.characterId,
      flattenGearInventories(gear.inventories),
      gear.loadouts,
    );
    const battleEffects = mergeIntoManifest(params.talents.talentEffects, params.homesteadEffectsRef.current);
    const activeModifiers =
      modifiers ??
      (params.run.selectedDifficulty
        ? getDifficultyModifiers(params.run.characterId, params.run.selectedDifficulty)
        : []);
    return createBattleState({
      runDeck: deck,
      gold,
      totalRooms: roomsEncountered,
      currentEnemy: enemy,
      playerHealth,
      talentEffects: battleEffects,
      discoveredCardIds: useAppStore.getState().discoveredCardIds,
      maxHealth: params.run.runMaxHealth,
      trinketIds: params.run.runTrinkets,
      gearEffects,
      difficultyModifiers: activeModifiers,
    });
  }

  function beginBattle(enemy: BestiaryEntry, deck: BattleCard[], gold: number, modifiers?: DifficultyModifier[]) {
    const presentationStore = useBattlePresentationStore.getState();
    params.resetBattleSession();
    presentationStore.resetCardTransfers();
    presentationStore.resetHandTransferUi();
    const startingHealth = syncRunToBattleStart();
    const nextRoomsEncountered = params.run.roomsEncountered + 1;
    params.run.setRoomsEncountered(nextRoomsEncountered);
    getPresentationStore().clearCardGhosts();
    const encounterTraitIds =
      params.run.contentSystemType === "labyrinth"
        ? (readRunSessionStore().activeLabyrinthModifiers as EncounterCombatTraitId[])
        : [];
    const battleEnemy = encounterTraitIds.length > 0 ? appendEncounterTraits(enemy, encounterTraitIds) : enemy;
    const nextBattleState = createBattleForEnemy(
      battleEnemy,
      deck,
      gold,
      startingHealth,
      nextRoomsEncountered,
      modifiers,
    );
    getStore().setSyncedBattleState(nextBattleState);
    getStore().setBattleStartState(nextBattleState);
    getStore().setHasActiveBattle(true);
    params.run.setEncounteredRunEnemyIds((current) => appendUnique(current, enemy.id));
    useAppStore.getState().setEncounteredEnemyIds((current) => appendUnique(current, enemy.id));
  }

  function startBattle(
    deck: BattleCard[] = params.run.runDeck,
    gold: number = params.run.runGold,
    enemyType: "normal" | "elite" = "normal",
    modifiers?: DifficultyModifier[],
  ) {
    beginBattle(getCurrentEnemy(enemyType, params.run.encounteredRunEnemyIds), deck, gold, modifiers);
  }

  function startBossBattle(modifiers?: DifficultyModifier[]) {
    beginBattle(getBossEnemy(params.run.encounteredRunEnemyIds), params.run.runDeck, params.run.runGold, modifiers);
  }

  function startBossById(
    bossId: string,
    modifiers?: DifficultyModifier[],
    wildwoodModifierId?: WildwoodModifierId,
  ): boolean {
    const boss = getBossById(bossId);
    if (!boss) {
      console.warn(`startBossById: boss "${bossId}" not found`);
      return false;
    }
    beginBattle(
      wildwoodModifierId ? withWildwoodModifier(boss, wildwoodModifierId) : boss,
      params.run.runDeck,
      params.run.runGold,
      modifiers,
    );
    return true;
  }

  return { startBattle, startBossBattle, startBossById };
}
