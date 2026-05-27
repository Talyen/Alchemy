// Enemy turn UI sequencing: haste skip, normal enemy phase, and post-attack draw.
// Depends on battle state machine results and battle store sync helpers.
// Used by useBattleController end-turn resolution.
import { endPlayerTurn, type BattleState, type CombatTextEvent } from "@/lib/battle";
import { playBattleEvent, playEnemyAttack } from "@/lib/audio";
import { ENEMY_ATTACK_RECOVERY_DELAY, ENEMY_PHASE_DELAY } from "@/lib/game-constants";
import { delay } from "@/lib/animation/game-timer";
import { applyCombatTextPortraitFeedback, shouldHurtEnemyFromCombatTexts } from "./battle-feedback";
import { runHandDrawSequence, type HandDrawSequenceDeps } from "./draw-sequence";

export type EndPlayerTurnResult = ReturnType<typeof endPlayerTurn>;

export type TurnResolutionStore = {
  showCombatTexts: (texts: CombatTextEvent[]) => void;
  setSyncedBattleState: (state: BattleState) => void;
  setDisplayOverrides: (overrides: {
    hand: [];
    playerHealth?: number;
    playerStatuses?: BattleState["playerStatuses"];
  }) => void;
  shakePlayer: () => void;
  hurtPlayer: () => void;
  hurtEnemy: () => void;
  shakeEnemy: () => void;
};

export function resolveHasteSkipTurn(
  result: EndPlayerTurnResult,
  companionState: BattleState,
  session: number,
  deps: {
    store: TurnResolutionStore;
    drawSequence: HandDrawSequenceDeps;
    onDrawComplete: (resultState: BattleState, session: number) => void;
    logDrawError: (err: unknown) => void;
    setResolvedAsHasteOrStun: (value: boolean) => void;
    clearHandTransferState: () => void;
    setCardPlayInProgress: (active: boolean) => void;
    runIfSessionActive: (session: number, action: () => void) => void;
  },
) {
  deps.setResolvedAsHasteOrStun(true);
  try {
    if (result.combatTexts.length > 0) deps.store.showCombatTexts(result.combatTexts);
  } catch (err) {
    deps.setResolvedAsHasteOrStun(false);
    throw err;
  }

  void runHandDrawSequence(
    companionState.hand,
    result.state,
    () => {
      deps.store.setSyncedBattleState(result.state);
    },
    session,
    deps.drawSequence,
  )
    .catch(deps.logDrawError)
    .finally(() => {
      deps.runIfSessionActive(session, () => {
        deps.setResolvedAsHasteOrStun(false);
        deps.clearHandTransferState();
        deps.setCardPlayInProgress(false);
        deps.onDrawComplete(result.state, session);
      });
    });
}

function showEnemyTurnStart(
  resultState: BattleState,
  currentState: BattleState,
  combatTexts: CombatTextEvent[],
  showPlayerUpdates: boolean,
  store: TurnResolutionStore,
) {
  store.setSyncedBattleState({ ...resultState, turnPhase: "enemy" });
  store.setDisplayOverrides({
    hand: [],
    ...(showPlayerUpdates
      ? {}
      : { playerHealth: currentState.playerHealth, playerStatuses: currentState.playerStatuses }),
  });
  const dotTexts = combatTexts.filter((ct) => ct.target === "enemy" || ct.kind === "heal");
  if (dotTexts.length > 0) store.showCombatTexts(dotTexts);
  if (shouldHurtEnemyFromCombatTexts(dotTexts)) store.hurtEnemy();
}

export function resolveNormalEnemyTurn(
  result: EndPlayerTurnResult,
  companionResult: { state: BattleState; combatTexts: CombatTextEvent[] },
  session: number,
  deps: {
    store: TurnResolutionStore;
    executeEnemyPhase: (
      resultState: BattleState,
      currentState: BattleState,
      combatTexts: CombatTextEvent[],
      session: number,
      playerTurnSkipped: boolean,
      enemyPerformedAttack: boolean,
    ) => void;
    onVictory: () => void;
    checkBattleEnd: (state: BattleState, session: number) => boolean;
  },
) {
  const enemyTurnStartTexts = result.enemyTurnStartState
    ? [...companionResult.combatTexts, ...result.enemyTurnStartCombatTexts]
    : [...companionResult.combatTexts, ...result.combatTexts];

  const enemyResolutionTexts = result.enemyTurnStartState ? result.enemyResolutionCombatTexts : result.combatTexts;

  showEnemyTurnStart(
    result.enemyTurnStartState ?? result.state,
    companionResult.state,
    enemyTurnStartTexts,
    Boolean(result.enemyTurnStartState),
    deps.store,
  );

  if (result.state.enemyHealth <= 0) {
    deps.store.setSyncedBattleState({ ...result.state, turnPhase: "enemy", hand: [] });
    deps.onVictory();
    return;
  }

  if (deps.checkBattleEnd(result.state, session)) return;

  deps.executeEnemyPhase(
    result.state,
    companionResult.state,
    enemyResolutionTexts,
    session,
    result.playerTurnSkipped,
    result.enemyPerformedAttack,
  );
}

export async function executeEnemyPhase(
  resultState: BattleState,
  currentState: BattleState,
  combatTexts: CombatTextEvent[],
  session: number,
  playerTurnSkipped: boolean,
  enemyPerformedAttack: boolean,
  deps: {
    isSessionActive: (session: number) => boolean;
    store: TurnResolutionStore;
    drawSequence: HandDrawSequenceDeps;
    logDrawError: (err: unknown) => void;
    onPhaseComplete: (resultState: BattleState, session: number, playerTurnSkipped: boolean) => void;
  },
) {
  const playerTexts = combatTexts.filter((ct) => ct.target === "player");
  await delay(ENEMY_PHASE_DELAY);
  if (!deps.isSessionActive(session)) return;
  if (enemyPerformedAttack) playEnemyAttack(currentState.currentEnemy.id);
  if (!currentState.deathsDoorActive && resultState.deathsDoorActive) playBattleEvent("deathsDoor");
  if (combatTexts.length > 0) deps.store.showCombatTexts(combatTexts);
  applyCombatTextPortraitFeedback(playerTexts, {
    shakeEnemy: deps.store.shakeEnemy,
    shakePlayer: deps.store.shakePlayer,
    hurtEnemy: deps.store.hurtEnemy,
    hurtPlayer: deps.store.hurtPlayer,
  });
  await delay(ENEMY_ATTACK_RECOVERY_DELAY);
  if (!deps.isSessionActive(session)) return;
  try {
    await runHandDrawSequence(
      currentState.hand,
      resultState,
      () => {
        deps.store.setSyncedBattleState(resultState);
      },
      session,
      deps.drawSequence,
    );
  } catch (err) {
    deps.logDrawError(err);
  }
  if (!deps.isSessionActive(session)) return;
  deps.onPhaseComplete(resultState, session, playerTurnSkipped);
}
