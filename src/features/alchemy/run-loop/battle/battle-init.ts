// Battle start helpers: enemy selection, state creation, and encounter tracking.
import { createBattleState, type CombatTextEvent } from "@/lib/battle";
import { getDifficultyModifiers, type BattleCard, type BestiaryEntry, type DifficultyModifier } from "@/lib/game-data";
import { mergeIntoManifest } from "@/lib/homestead/effects";
import { getBossById, getCurrentEnemy, getBossEnemy } from "@/features/alchemy/shared/config";
import { readBattle, readRunSession } from "@/features/alchemy/shared/stores/run-session-read-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { syncRunToBattleStart } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { useBattlePresentationStore } from "./battle-presentation-store";
import { appendUnique } from "@/lib/utils";
import { readProfileStore, setEncounteredEnemyIds } from "../../shared/stores/profile-port";
import { withWildwoodModifier, type WildwoodModifierId } from "@/lib/content-systems/wildwood/gauntlet";
import { appendEncounterTraits } from "@/lib/content-systems/encounter-traits";
import { readGearManifestForCharacter } from "../../shared/stores/gear-read-port";
import type { BattleControllerContext } from "./battle-context";
import type { createBattleSession } from "./battle-session";

export function createBattleInit(
  ctx: BattleControllerContext,
  session: ReturnType<typeof createBattleSession>,
  rng: () => number = Math.random,
) {
  const getStore = () => readBattle();

  function createBattleForEnemy(
    enemy: BestiaryEntry,
    deck: BattleCard[],
    gold: number,
    playerHealth: number,
    roomsEncountered: number,
    modifiers?: DifficultyModifier[],
  ) {
    const gearEffects = readGearManifestForCharacter(ctx.run.characterId);
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
      discoveredCardIds: readProfileStore().discoveredCardIds,
      maxHealth: ctx.run.runMaxHealth,
      trinketIds: ctx.run.runTrinkets,
      gearEffects,
      difficultyModifiers: activeModifiers,
    });
  }

  function beginBattle(enemy: BestiaryEntry, deck: BattleCard[], gold: number, modifiers?: DifficultyModifier[]) {
    dispatchRunSessionCommand(
      () => {
        const startingHealth = syncRunToBattleStart();
        const nextRoomsEncountered = ctx.run.roomsEncountered + 1;
        ctx.run.setRoomsEncountered(nextRoomsEncountered);
        const encounterTraitIds =
          ctx.run.contentSystemType === "labyrinth" ? readRunSession().activeLabyrinthModifiers : [];
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
        setEncounteredEnemyIds((current) => appendUnique(current, enemy.id));

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
        return startingTexts;
      },
      {
        afterCommit: (startingTexts) => {
          if (typeof session.prepareBattleSessionForStart === "function") {
            session.prepareBattleSessionForStart();
          } else {
            // Legacy test doubles may only expose the original reset helper.
            session.resetBattleSession();
          }
          const presentationStore = useBattlePresentationStore.getState();
          presentationStore.resetCardTransfers();
          presentationStore.resetHandTransferUi();
          presentationStore.clearCardGhosts();
          if (startingTexts.length > 0) presentationStore.showCombatTexts(startingTexts);
        },
      },
    );
  }

  function startBattle(
    deck: BattleCard[] = ctx.run.runDeck,
    gold: number = ctx.run.runGold,
    enemyType: "normal" | "elite" = "normal",
    modifiers?: DifficultyModifier[],
  ) {
    beginBattle(getCurrentEnemy(enemyType, ctx.run.encounteredRunEnemyIds, rng), deck, gold, modifiers);
  }

  function startBossBattle(modifiers?: DifficultyModifier[]) {
    beginBattle(getBossEnemy(ctx.run.encounteredRunEnemyIds, rng), ctx.run.runDeck, ctx.run.runGold, modifiers);
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
