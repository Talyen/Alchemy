import {
  createBattleStartState,
  drawOpeningHand,
  isPlayerDefeated,
  processCompanionTurnStart,
  type CombatTextEvent,
} from "@/lib/battle";
import { getDifficultyModifiers, type BattleCard, type BestiaryEntry, type DifficultyModifier } from "@/lib/game-data";
import { getBossById, getCurrentEnemy, getBossEnemy, enemyById, isEnemyId } from "@/features/alchemy/shared/config";
import { readBattle } from "@/features/alchemy/shared/stores/run-session-read-port";
import { dispatchRunSessionCommand, type GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import {
  beginBattleTransition,
  createDraftRunRandomSource,
  initializeActiveBattle,
  setEncounteredRunEnemyIds,
  setRoomsEncountered,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { syncRunToBattleStart } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { appendUnique } from "@/lib/utils";
import { setEncounteredEnemyIds } from "../../shared/stores/profile-store";
import { withWildwoodModifier, type WildwoodModifierId } from "@/lib/content-systems/wildwood/gauntlet";
import { appendEncounterTraits } from "@/lib/content-systems/encounter-traits";
import { preloadBattleSounds } from "@/lib/audio";
import { applyCombatTextShakeFeedback } from "./battle-feedback";
import { playCompanionSound, playCombatTextSounds } from "./controller-utils";
import type { BattleControllerContext } from "./battle-context";
import type { createBattleSession } from "./battle-session";
import { deriveCombatMeta } from "@/features/alchemy/shared/stores/combat-meta";

export function createBattleInit(ctx: BattleControllerContext, session: ReturnType<typeof createBattleSession>) {
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
        }
        const openingDrawState = drawOpeningHand(nextBattleState);
        initializeActiveBattle(draft, nextBattleState, null);
        beginBattleTransition(draft, nextBattleState, { kind: "opening-draw", resultState: openingDrawState }, {});
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
      {
        afterCommit: ({ startingTexts, companionId, outcome, openingCardIds }) => {
          const battleState = readBattle().battleState;
          preloadBattleSounds(openingCardIds, battleState.currentEnemy.id);
          if (typeof session.prepareBattleSessionForStart === "function") {
            session.prepareBattleSessionForStart();
          } else {
            session.resetBattleSession();
          }
          const presentationStore = ctx.getPresentation();
          presentationStore.resetCardTransfers();
          presentationStore.resetHandTransferUi();
          presentationStore.clearCardGhosts();
          presentationStore.setCardTransferInProgress(true);
          if (companionId) {
            playCompanionSound(companionId);
            presentationStore.shakeCompanion();
            presentationStore.telegraphAttack("companion");
          }
          if (startingTexts.length > 0) {
            presentationStore.showCombatTexts(startingTexts);
            applyCombatTextShakeFeedback(startingTexts, presentationStore);
            playCombatTextSounds(startingTexts);
          }
          if (outcome) session.handleVictoryDefeat?.(outcome);
        },
      },
    );
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
