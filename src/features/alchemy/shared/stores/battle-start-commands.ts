import { enemyById, getBossById, getBossEnemy, getCurrentEnemy, isEnemyId } from "@/features/alchemy/shared/config";
import { defaultGameSession } from "@/features/alchemy/shared/stores/default-game-session";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { dispatchGameplayCommand, type GameplayDraft } from "@/features/alchemy/shared/stores/gameplay-command";
import { syncRunToBattleStart } from "@/features/alchemy/shared/stores/run-lifecycle";
import { acceptCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  createDraftRunRandomSource,
  deriveCombatMeta,
  recordRunRoom,
  setEncounteredEnemyIds,
  setEncounteredRunEnemyIds,
  setRoomsEncountered,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { resolveBattleStart, type CombatTextEvent } from "@/lib/battle";
import { appendEncounterTraits } from "@/lib/content-systems/encounter-traits";
import { withWildwoodModifier, type WildwoodModifierId } from "@/lib/content-systems/wildwood/gauntlet";
import { getDifficultyModifiers, type BestiaryEntry, type DifficultyModifier } from "@/lib/game-data";
import { DESTINATIONS } from "@/lib/routing";
import { appendUnique } from "@/lib/utils";
import { commitResolvedBattle, initializeActiveBattle } from "./write/run-battle";

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

export function createBattleStartCommands(
  onStarted: (result: BattleStarted) => void,
  gameSession: GameSession = defaultGameSession,
) {
  function beginBattle(
    resolveEnemy: (draft: GameplayDraft) => BestiaryEntry,
    options: Pick<BattleStartOptions, "modifiers">,
  ) {
    dispatchGameplayCommand(
      (draft) => {
        const enemy = resolveEnemy(draft);
        const startingHealth = syncRunToBattleStart(draft);
        const run = draft.run.activeRun;
        const nextRoomsEncountered = run.roomsEncountered + 1;
        setRoomsEncountered(draft, nextRoomsEncountered);
        const encounterTraitIds = run.contentSystemType === "labyrinth" ? draft.session.activeLabyrinthModifiers : [];
        const battleEnemy = encounterTraitIds.length > 0 ? appendEncounterTraits(enemy, encounterTraitIds) : enemy;
        const combatMeta = deriveCombatMeta(draft);
        const startingGold = draft.runProfile.gold;
        const opening = resolveBattleStart(
          {
            runDeck: run.runDeck,
            gold: startingGold,
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
          },
          { rng: createDraftRunRandomSource(draft, "world") },
        );
        initializeActiveBattle(draft, opening.state);
        commitResolvedBattle(draft, { ...opening.state, gold: startingGold }, opening.state);
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

        const startingTexts = [...(opening.companion?.texts ?? [])];
        if (opening.state.enemyMitigation.armor > 0) {
          startingTexts.push({
            target: "enemy",
            kind: "status",
            stat: "armor",
            amount: opening.state.enemyMitigation.armor,
          });
        }
        if (opening.state.enemyMitigation.block > 0) {
          startingTexts.push({
            target: "enemy",
            kind: "status",
            stat: "block",
            amount: opening.state.enemyMitigation.block,
          });
        }
        return acceptCommand({
          startingTexts,
          companionId: opening.companion?.id ?? null,
          outcome: opening.outcome,
          openingCardIds: opening.state.hand.map((card) => card.id),
        });
      },
      { afterCommit: onStarted },
      gameSession,
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
