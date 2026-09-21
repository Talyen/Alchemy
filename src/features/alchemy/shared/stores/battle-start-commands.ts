import {
  createBattleStartState,
  drawOpeningHand,
  isPlayerDefeated,
  processCompanionTurnStart,
  type CombatTextEvent,
} from "@/lib/battle";
import { getDifficultyModifiers, type BattleCard, type BestiaryEntry, type DifficultyModifier } from "@/lib/game-data";
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

export function createBattleStartCommands(onStarted: (result: BattleStarted) => void) {
  function createBattleForEnemy(
    draft: GameplayDraft,
    enemy: BestiaryEntry,
    deck: BattleCard[],
    gold: number,
    playerHealth: number,
    roomsEncountered: number,
    battleRng: () => number,
    modifiers?: DifficultyModifier[],
  ) {
    const run = draft.run.activeRun;
    const combatMeta = deriveCombatMeta(draft);
    const activeModifiers =
      modifiers ?? (run.selectedDifficulty ? getDifficultyModifiers(run.characterId, run.selectedDifficulty) : []);
    return createBattleStartState({
      runDeck: deck,
      gold,
      totalRooms: roomsEncountered,
      currentEnemy: enemy,
      playerHealth,
      talentEffects: combatMeta.talentEffects,
      discoveredCardIds: draft.profile.discoveredCardIds,
      maxHealth: run.runMaxHealth,
      trinketIds: combatMeta.activeTrinketIds,
      gearEffects: combatMeta.gearEffects,
      difficultyModifiers: activeModifiers,
      contentSystemType: run.contentSystemType,
      encounterBenefits: draft.session.activeLabyrinthRewardModifiers,
      rng: battleRng,
    });
  }

  function beginBattle(
    resolveEnemy: (draft: GameplayDraft) => BestiaryEntry,
    deck: BattleCard[] | undefined,
    gold: number | undefined,
    modifiers?: DifficultyModifier[],
  ) {
    dispatchRunSessionCommand((draft) => resolveBattleStartState(draft, resolveEnemy, deck, gold, modifiers), {
      afterCommit: onStarted,
    });
  }

  function resolveBattleStartState(
    draft: GameplayDraft,
    resolveEnemy: (draft: GameplayDraft) => BestiaryEntry,
    deck: BattleCard[] | undefined,
    gold: number | undefined,
    modifiers?: DifficultyModifier[],
  ) {
    const enemy = resolveEnemy(draft);
    const startingHealth = syncRunToBattleStart(draft);
    const run = draft.run.activeRun;
    const nextRoomsEncountered = run.roomsEncountered + 1;
    setRoomsEncountered(draft, nextRoomsEncountered);
    const encounterTraitIds = run.contentSystemType === "labyrinth" ? draft.session.activeLabyrinthModifiers : [];
    const battleEnemy = encounterTraitIds.length > 0 ? appendEncounterTraits(enemy, encounterTraitIds) : enemy;
    let nextBattleState = createBattleForEnemy(
      draft,
      battleEnemy,
      deck ?? run.runDeck,
      gold ?? draft.runProfile.gold,
      startingHealth,
      nextRoomsEncountered,
      createDraftRunRandomSource(draft, "world"),
      modifiers,
    );
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
  }

  function startBattle(
    deck?: BattleCard[],
    gold?: number,
    enemyType: "normal" | "elite" = "normal",
    modifiers?: DifficultyModifier[],
    enemyId?: string,
  ) {
    beginBattle(
      (draft) => {
        if (enemyId && isEnemyId(enemyId)) return enemyById[enemyId];
        return getCurrentEnemy(
          enemyType,
          draft.run.activeRun.encounteredRunEnemyIds,
          createDraftRunRandomSource(draft, "world"),
        );
      },
      deck,
      gold,
      modifiers,
    );
  }

  function startBossBattle(modifiers?: DifficultyModifier[], enemyId?: string) {
    beginBattle(
      (draft) => {
        if (enemyId && isEnemyId(enemyId) && enemyById[enemyId].enemyType === "boss") return enemyById[enemyId];
        return getBossEnemy(draft.run.activeRun.encounteredRunEnemyIds, createDraftRunRandomSource(draft, "world"));
      },
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
      logError(`Failed to start boss "${bossId}" (unknown boss id)`, "battle");
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
