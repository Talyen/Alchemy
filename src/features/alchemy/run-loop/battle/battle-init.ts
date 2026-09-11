import { useBattlePresentationStore } from "./battle-presentation-store";
import {
  createBattleStartState,
  drawOpeningHand,
  isPlayerDefeated,
  processCompanionTurnStart,
  type CombatTextEvent,
} from "@/lib/battle";
import { getDifficultyModifiers, type BattleCard, type BestiaryEntry, type DifficultyModifier } from "@/lib/game-data";
import { getBossById, getCurrentEnemy, getBossEnemy, enemyById, isEnemyId } from "@/features/alchemy/shared/config";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import { dispatchRunSessionCommand, type GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import {
  createDraftRunRandomSource,
  initializeActiveBattle,
  setEncounteredEnemyIds,
  setEncounteredRunEnemyIds,
  setRoomsEncountered,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { syncRunToBattleStart } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { appendUnique } from "@/lib/utils";
import { withWildwoodModifier, type WildwoodModifierId } from "@/lib/content-systems/wildwood/gauntlet";
import { appendEncounterTraits } from "@/lib/content-systems/encounter-traits";
import { preloadBattleSounds } from "@/lib/audio";
import { applyCombatTextShakeFeedback } from "./battle-status";
import { playCompanionSound, playCombatTextSounds } from "./controller-utils";
import type { BattleControllerContext } from "./battle-context";
import type { createBattleSession } from "./battle-session";
import type { createBattleTransferDeps } from "./battle-transfer-deps";
import { runBattleDraw } from "./draw-sequence";
import { deriveCombatMeta } from "@/features/alchemy/shared/stores/run-meta-rebind";

export async function playBattleOpeningDraw(
  ctx: Pick<BattleControllerContext, "battleSessionRef" | "scheduleAutoEndTurnRef">,
  transferDeps: Pick<ReturnType<typeof createBattleTransferDeps>, "getDrawSequenceDeps">,
): Promise<boolean> {
  const current = readBattle();
  const presentation = useBattlePresentationStore.getState();
  if (!presentation.openingDrawPending) return false;
  presentation.setOpeningDrawPending(false);
  const sessionNum = ctx.battleSessionRef.current;

  const completed = await runBattleDraw({
    oldHand: [],
    newState: current.battleState,
    onReveal: () => {},
    session: sessionNum,
    deps: transferDeps.getDrawSequenceDeps(),
    errorContext: "draw opening hand",
  });
  if (sessionNum === ctx.battleSessionRef.current) {
    ctx.scheduleAutoEndTurnRef.current?.(readBattle().battleState);
  }
  return completed;
}

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
          if (nextBattleState.encounterBenefits.includes("eager-pack"))
            nextBattleState = processCompanionTurnStart(nextBattleState, companionTexts);
        }
        const openingDrawState = drawOpeningHand(nextBattleState);
        initializeActiveBattle(draft, openingDrawState, null);
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
          preloadBattleSounds([...openingCardIds, ...battleState.currentEnemy.abilityIds], battleState.currentEnemy.id);
          session.prepareBattleSessionForStart();
          const presentationStore = ctx.getPresentation();
          presentationStore.resetPresentation();
          presentationStore.setOpeningDrawPending(true);
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
