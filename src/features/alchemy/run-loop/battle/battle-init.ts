// Battle start helpers: enemy selection, state creation, and encounter tracking.
import { createBattleState, getBattleStartPlayerHealth, type CombatTextEvent } from "@/lib/battle";
export { getBattleStartPlayerHealth };
import { getDifficultyModifiers, type BattleCard, type BestiaryEntry, type DifficultyModifier } from "@/lib/game-data";
import { mergeIntoManifest } from "@/lib/homestead/effects";
import { getBossById, getCurrentEnemy, getBossEnemy } from "@/features/alchemy/shared/config";
import { readBattleStore, readRunSessionStore } from "../../shared/stores/run-session-facade";
import { useBattlePresentationStore } from "./battle-presentation-store";
import { appendUnique } from "@/lib/utils";
import { useAppStore } from "../../shared/stores/app-store";
import { syncRunToBattleStart } from "../../shared/stores/run-transitions";
import { withWildwoodModifier, type WildwoodModifierId } from "@/lib/content-systems/wildwood/gauntlet";
import { appendEncounterTraits, type EncounterCombatTraitId } from "@/lib/content-systems/encounter-traits";
import { computeGearManifest, flattenGearInventories } from "@/lib/gear";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";
import type { BattleControllerContext } from "./battle-context";
import type { createBattleSession } from "./battle-session";

export function createBattleInit(ctx: BattleControllerContext, session: ReturnType<typeof createBattleSession>) {
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
      ctx.run.characterId,
      flattenGearInventories(gear.inventories),
      gear.loadouts,
    );
    const battleEffects = mergeIntoManifest(ctx.talents.talentEffects, ctx.homesteadEffects);
    const activeModifiers =
      modifiers ??
      (ctx.run.selectedDifficulty ? getDifficultyModifiers(ctx.run.characterId, ctx.run.selectedDifficulty) : []);
    return createBattleState({
      runDeck: deck,
      gold,
      totalRooms: roomsEncountered,
      currentEnemy: enemy,
      playerHealth,
      talentEffects: battleEffects,
      discoveredCardIds: useAppStore.getState().discoveredCardIds,
      maxHealth: ctx.run.runMaxHealth,
      trinketIds: ctx.run.runTrinkets,
      gearEffects,
      difficultyModifiers: activeModifiers,
    });
  }

  function beginBattle(enemy: BestiaryEntry, deck: BattleCard[], gold: number, modifiers?: DifficultyModifier[]) {
    const presentationStore = useBattlePresentationStore.getState();
    session.resetBattleSession();
    presentationStore.resetCardTransfers();
    presentationStore.resetHandTransferUi();
    const startingHealth = syncRunToBattleStart();
    const nextRoomsEncountered = ctx.run.roomsEncountered + 1;
    ctx.run.setRoomsEncountered(nextRoomsEncountered);
    getPresentationStore().clearCardGhosts();
    const encounterTraitIds =
      ctx.run.contentSystemType === "labyrinth"
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
    ctx.run.setEncounteredRunEnemyIds((current) => appendUnique(current, enemy.id));
    useAppStore.getState().setEncounteredEnemyIds((current) => appendUnique(current, enemy.id));
    // Emit floating combat text for starting enemy armor and block
    const startingTexts: CombatTextEvent[] = [];
    if (nextBattleState.enemyMitigation.armor > 0) {
      startingTexts.push({
        target: "enemy",
        kind: "status",
        stat: "armor",
        amount: nextBattleState.enemyMitigation.armor,
      });
    }
    if (nextBattleState.enemyMitigation.block > 0) {
      startingTexts.push({
        target: "enemy",
        kind: "status",
        stat: "block",
        amount: nextBattleState.enemyMitigation.block,
      });
    }
    if (startingTexts.length > 0) {
      getPresentationStore().showCombatTexts(startingTexts);
    }
  }

  function startBattle(
    deck: BattleCard[] = ctx.run.runDeck,
    gold: number = ctx.run.runGold,
    enemyType: "normal" | "elite" = "normal",
    modifiers?: DifficultyModifier[],
  ) {
    beginBattle(getCurrentEnemy(enemyType, ctx.run.encounteredRunEnemyIds), deck, gold, modifiers);
  }

  function startBossBattle(modifiers?: DifficultyModifier[]) {
    beginBattle(getBossEnemy(ctx.run.encounteredRunEnemyIds), ctx.run.runDeck, ctx.run.runGold, modifiers);
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
      ctx.run.runDeck,
      ctx.run.runGold,
      modifiers,
    );
    return true;
  }

  return { startBattle, startBossBattle, startBossById };
}
