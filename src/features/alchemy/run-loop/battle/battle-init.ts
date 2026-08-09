// Battle start helpers: enemy selection, state creation, and encounter tracking.
import { createBattleState, type CombatTextEvent } from "@/lib/battle";
import { getDifficultyModifiers, type BattleCard, type BestiaryEntry, type DifficultyModifier } from "@/lib/game-data";
import { mergeIntoManifest } from "@/lib/homestead/effects";
import { getBossById, getCurrentEnemy, getBossEnemy } from "@/features/alchemy/shared/config";
import { readActiveRun } from "@/features/alchemy/shared/stores/run-session-read-port";
import { dispatchRunSessionCommand, type GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import {
  createDraftRunRandomSource,
  initializeActiveBattle,
  setEncounteredRunEnemyIds,
  setRoomsEncountered,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { syncRunToBattleStart } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { useBattlePresentationStore } from "./battle-presentation-store";
import { appendUnique } from "@/lib/utils";
import { readProfileStore, setEncounteredEnemyIds } from "../../shared/stores/profile-store";
import { withWildwoodModifier, type WildwoodModifierId } from "@/lib/content-systems/wildwood/gauntlet";
import { appendEncounterTraits } from "@/lib/content-systems/encounter-traits";
import { readGearManifestForCharacter } from "../../shared/stores/gear-store";
import type { BattleControllerContext } from "./battle-context";
import type { createBattleSession } from "./battle-session";

export function createBattleInit(ctx: BattleControllerContext, session: ReturnType<typeof createBattleSession>) {
  function createBattleForEnemy(
    enemy: BestiaryEntry,
    deck: BattleCard[],
    gold: number,
    playerHealth: number,
    roomsEncountered: number,
    battleRng: () => number,
    modifiers?: DifficultyModifier[],
  ) {
    const run = readActiveRun();
    const gearEffects = readGearManifestForCharacter(run.characterId);
    const battleEffects = mergeIntoManifest(ctx.talents.talentEffects, ctx.homesteadEffects);
    const activeModifiers =
      modifiers ?? (run.selectedDifficulty ? getDifficultyModifiers(run.characterId, run.selectedDifficulty) : []);
    return createBattleState({
      runDeck: deck,
      gold,
      totalRooms: roomsEncountered,
      currentEnemy: enemy,
      playerHealth,
      talentEffects: battleEffects,
      discoveredCardIds: readProfileStore().discoveredCardIds,
      maxHealth: run.runMaxHealth,
      trinketIds: run.runTrinkets,
      gearEffects,
      difficultyModifiers: activeModifiers,
      rng: battleRng,
    });
  }

  function beginBattle(
    resolveEnemy: (draft: GameplayDraft) => BestiaryEntry,
    deck: BattleCard[] | undefined,
    gold: number | undefined,
    modifiers?: DifficultyModifier[],
  ) {
    dispatchRunSessionCommand(
      (draft) => {
        const enemy = resolveEnemy(draft);
        const startingHealth = syncRunToBattleStart(draft);
        const run = draft.run.activeRun;
        const nextRoomsEncountered = run.roomsEncountered + 1;
        setRoomsEncountered(draft, nextRoomsEncountered);
        const encounterTraitIds = run.contentSystemType === "labyrinth" ? draft.session.activeLabyrinthModifiers : [];
        const battleEnemy = encounterTraitIds.length > 0 ? appendEncounterTraits(enemy, encounterTraitIds) : enemy;
        const nextBattleState = createBattleForEnemy(
          battleEnemy,
          deck ?? run.runDeck,
          gold ?? run.runGold,
          startingHealth,
          nextRoomsEncountered,
          createDraftRunRandomSource(draft, "world"),
          modifiers,
        );
        initializeActiveBattle(draft, nextBattleState, null);
        setEncounteredRunEnemyIds(draft, (current) => appendUnique(current, enemy.id));
        setEncounteredEnemyIds(draft, (current) => appendUnique(current, enemy.id));

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
    deck?: BattleCard[],
    gold?: number,
    enemyType: "normal" | "elite" = "normal",
    modifiers?: DifficultyModifier[],
  ) {
    beginBattle(
      (draft) =>
        getCurrentEnemy(
          enemyType,
          draft.run.activeRun.encounteredRunEnemyIds,
          createDraftRunRandomSource(draft, "world"),
        ),
      deck,
      gold,
      modifiers,
    );
  }

  function startBossBattle(modifiers?: DifficultyModifier[]) {
    beginBattle(
      (draft) => getBossEnemy(draft.run.activeRun.encounteredRunEnemyIds, createDraftRunRandomSource(draft, "world")),
      undefined,
      undefined,
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
      () => (wildwoodModifierId ? withWildwoodModifier(boss, wildwoodModifierId) : boss),
      undefined,
      undefined,
      modifiers,
    );
    return true;
  }

  return { startBattle, startBossBattle, startBossById };
}
