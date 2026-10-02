import {
  createBattleStartState,
  drawOpeningHand,
  isPlayerDefeated,
  processCompanionTurnStart,
  type CombatTextEvent,
} from "@/lib/battle";
import { getDifficultyModifiers, type BestiaryEntry, type DifficultyModifier } from "@/lib/game-data";
import { getBossById, getCurrentEnemy, getBossEnemy, enemyById, isEnemyId } from "@/features/alchemy/shared/config";
import { dispatchRunSessionCommand, type GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import {
  createDraftRunRandomSource,
  setEncounteredEnemyIds,
  setEncounteredRunEnemyIds,
  setRoomsEncountered,
  recordRunRoom,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { initializeActiveBattle } from "./write/run-battle";
import { syncRunToBattleStart } from "@/features/alchemy/shared/stores/run-lifecycle";
import { DESTINATIONS } from "@/lib/routing";
import { appendUnique } from "@/lib/utils";
import { withWildwoodModifier, type WildwoodModifierId } from "@/lib/content-systems/wildwood/gauntlet";
import { appendEncounterTraits } from "@/lib/content-systems/encounter-traits";
import { deriveCombatMeta } from "@/features/alchemy/shared/stores/run-session-write-port";

import { logError } from "@/lib/error-logger";

export interface BattleStarted {
  startingTexts: CombatTextEvent[];
  companionId: string | null;
  outcome: "victory" | "defeat" | null;
  openingCardIds: string[];
}

export interface BattleStartOptions {
  enemyType?: "normal" | "elite" | undefined;
  modifiers?: DifficultyModifier[] | undefined;
  enemyId?: string | undefined;
}

type BossBattleStartOptions = Pick<BattleStartOptions, "modifiers" | "enemyId">;

interface BossByIdOptions extends Pick<BattleStartOptions, "modifiers"> {
  bossId: string;
  wildwoodModifierId?: WildwoodModifierId | undefined;
}

export type BattleStartCommands = ReturnType<typeof createBattleStartCommands>;

export function createBattleStartCommands(onStarted: (result: BattleStarted) => void) {
  function beginBattle(
    resolveEnemy: (draft: GameplayDraft) => BestiaryEntry,
    options: Pick<BattleStartOptions, "modifiers">,
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
        const combatMeta = deriveCombatMeta(draft);
        let nextBattleState = createBattleStartState({
          runDeck: run.runDeck,
          gold: draft.runProfile.gold,
          totalRooms: nextRoomsEncountered,
          currentEnemy: battleEnemy,
          playerHealth: startingHealth,
          talentEffects: combatMeta.talentEffects,
          discoveredCardIds: draft.profile.discoveredCardIds,
          maxHealth: run.runMaxHealth,
          trinketIds: combatMeta.activeTrinketIds,
          gearEffects: combatMeta.gearEffects,
          difficultyModifiers:
            options.modifiers ??
            (run.selectedDifficulty ? getDifficultyModifiers(run.characterId, run.selectedDifficulty) : []),
          contentSystemType: run.contentSystemType,
          encounterBenefits: draft.session.activeLabyrinthRewardModifiers,
          rng: createDraftRunRandomSource(draft, "world"),
        });
        const companionTexts: CombatTextEvent[] = [];
        const companionId = nextBattleState.activeCompanion?.id ?? null;
        if (companionId) {
          nextBattleState = processCompanionTurnStart(nextBattleState, companionTexts);
          if (nextBattleState.encounterBenefits.includes("eager-pack"))
            nextBattleState = processCompanionTurnStart(nextBattleState, companionTexts);
        }
        const openingDrawState = drawOpeningHand(nextBattleState);
        initializeActiveBattle(draft, openingDrawState);
        if (run.contentSystemType !== "labyrinth" && draft.session.rewardFlow.claim.kind !== "destination") {
          const destination =
            enemy.enemyType === "boss"
              ? DESTINATIONS.BOSS_COMBAT
              : enemy.enemyType === "elite"
                ? DESTINATIONS.ELITE_COMBAT
                : DESTINATIONS.NORMAL_COMBAT;
          recordRunRoom(draft, destination, `${run.contentSystemType}:battle:${nextRoomsEncountered}`);
        }
        setEncounteredRunEnemyIds(draft, (current) => appendUnique(current, enemy.id));
        setEncounteredEnemyIds(draft, (current) => appendUnique(current, enemy.id));

        const startingTexts: CombatTextEvent[] = [...companionTexts];
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
        const outcome: "victory" | "defeat" | null = isPlayerDefeated(nextBattleState)
          ? "defeat"
          : nextBattleState.enemyHealth <= 0
            ? "victory"
            : null;
        return { startingTexts, companionId, outcome, openingCardIds: openingDrawState.hand.map((card) => card.id) };
      },
      { afterCommit: onStarted },
    );
  }

  function startBattle(options: BattleStartOptions = {}) {
    beginBattle((draft) => {
      if (options.enemyId && isEnemyId(options.enemyId)) return enemyById[options.enemyId];
      return getCurrentEnemy(
        options.enemyType ?? "normal",
        draft.run.activeRun.encounteredRunEnemyIds,
        createDraftRunRandomSource(draft, "world"),
      );
    }, options);
  }

  function startBossBattle(options: BossBattleStartOptions = {}) {
    beginBattle((draft) => {
      if (options.enemyId && isEnemyId(options.enemyId) && enemyById[options.enemyId].enemyType === "boss")
        return enemyById[options.enemyId];
      return getBossEnemy(draft.run.activeRun.encounteredRunEnemyIds, createDraftRunRandomSource(draft, "world"));
    }, options);
  }

  function startBossById({ bossId, modifiers, wildwoodModifierId }: BossByIdOptions): boolean {
    const boss = getBossById(bossId);
    if (!boss) {
      logError(`Failed to start boss "${bossId}" (unknown boss id)`, "battle");
      return false;
    }
    beginBattle(() => (wildwoodModifierId ? withWildwoodModifier(boss, wildwoodModifierId) : boss), { modifiers });
    return true;
  }

  return { startBattle, startBossBattle, startBossById };
}
