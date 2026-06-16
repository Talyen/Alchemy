// Battle start helpers: enemy selection, state creation, and encounter tracking.
import { createBattleState, getBattleStartPlayerHealth } from "@/lib/battle";
export { getBattleStartPlayerHealth };
import { getDifficultyModifiers, type BattleCard, type BestiaryEntry, type DifficultyModifier } from "@/lib/game-data";
import { mergeIntoManifest } from "@/lib/homestead/effects";
import { getBossById, getCurrentEnemy, getBossEnemy } from "@/features/alchemy/shared/config";
import { readBattleStore, readRunSessionStore } from "../../shared/stores/run-session-facade";
import { useBattlePresentationStore } from "../../shared/stores/battle-presentation-store";
import { appendUnique } from "@/lib/utils";
import { useAppStore } from "../../shared/stores/app-store";
import { syncRunToBattleStart } from "../../shared/stores/run-transitions";
import type { BattleControllerContext } from "./controller-context";
import { withWildwoodModifier, type WildwoodModifierId } from "@/lib/content-systems/wildwood/gauntlet";
import { appendEncounterTraits, type EncounterCombatTraitId } from "@/lib/content-systems/encounter-traits";
import { computeGearManifest } from "@/lib/gear";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";

export function createBattleInit(contextOrGetter: BattleControllerContext | (() => BattleControllerContext)) {
  const getContext = typeof contextOrGetter === "function" ? contextOrGetter : () => contextOrGetter;
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
    const context = getContext();
    const gear = useGearStore.getState();
    const gearEffects = computeGearManifest(context.run.characterId, gear.inventory, gear.loadouts);
    const battleEffects = mergeIntoManifest(context.talents.talentEffects, context.homesteadEffectsRef.current);
    const activeModifiers =
      modifiers ??
      (context.run.selectedDifficulty
        ? getDifficultyModifiers(context.run.characterId, context.run.selectedDifficulty)
        : []);
    return createBattleState({
      runDeck: deck,
      gold,
      totalRooms: roomsEncountered,
      currentEnemy: enemy,
      playerHealth,
      talentEffects: battleEffects,
      discoveredCardIds: useAppStore.getState().discoveredCardIds,
      maxHealth: context.run.runMaxHealth,
      trinketIds: context.run.runTrinkets,
      gearEffects,
      difficultyModifiers: activeModifiers,
    });
  }

  function beginBattle(enemy: BestiaryEntry, deck: BattleCard[], gold: number, modifiers?: DifficultyModifier[]) {
    const context = getContext();
    context.resetBattleSession();
    context.setCardTransfers([]);
    context.setHiddenHandCardKeys(new Set());
    context.setCardTransferInProgress(false);
    const startingHealth = syncRunToBattleStart();
    const nextRoomsEncountered = context.run.roomsEncountered + 1;
    context.run.setRoomsEncountered(nextRoomsEncountered);
    getPresentationStore().clearCardGhosts();
    const encounterTraitIds =
      context.run.contentSystemType === "labyrinth"
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
    context.run.setEncounteredRunEnemyIds((current) => appendUnique(current, enemy.id));
    useAppStore.getState().setEncounteredEnemyIds((current) => appendUnique(current, enemy.id));
  }

  function startBattle(
    deck: BattleCard[] = getContext().run.runDeck,
    gold: number = getContext().run.runGold,
    enemyType: "normal" | "elite" = "normal",
    modifiers?: DifficultyModifier[],
  ) {
    beginBattle(getCurrentEnemy(enemyType, getContext().run.encounteredRunEnemyIds), deck, gold, modifiers);
  }

  function startBossBattle(modifiers?: DifficultyModifier[]) {
    beginBattle(
      getBossEnemy(getContext().run.encounteredRunEnemyIds),
      getContext().run.runDeck,
      getContext().run.runGold,
      modifiers,
    );
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
      getContext().run.runDeck,
      getContext().run.runGold,
      modifiers,
    );
    return true;
  }

  return { startBattle, startBossBattle, startBossById };
}
