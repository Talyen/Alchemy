// Battle session identity, victory/defeat guards, and timeout/transfer cleanup.
import { isPlayerDefeated, type BattleState } from "@/lib/battle";
import { stopAllSfx } from "@/lib/audio";
import { readBattleStore } from "../../shared/stores/run-session-facade";
import { useBattlePresentationStore } from "../../shared/stores/battle-presentation-store";
import type { BattleControllerContext } from "./controller-context";

/** Domain battle state plus presentation VFX actions used by turn/card-play orchestration. */
export function getBattleSessionStore() {
  return { ...readBattleStore(), ...useBattlePresentationStore.getState() };
}

export function createBattleSession(contextOrGetter: BattleControllerContext | (() => BattleControllerContext)) {
  const getContext = typeof contextOrGetter === "function" ? contextOrGetter : () => contextOrGetter;
  const getStore = () => readBattleStore();
  const getPresentationStore = () => useBattlePresentationStore.getState();

  function isBattleSessionActive(session: number) {
    const context = getContext();
    if (session !== context.battleSessionRef.current) return false;
    const store = getStore();
    return store.hasActiveBattle || (context.victoryDefeatHandledRef.current && store.battleState.enemyHealth <= 0);
  }

  function isCurrentBattleSession(session: number) {
    return isBattleSessionActive(session);
  }

  function runIfSessionActive<T>(session: number, fn: () => T, fallback: T): T;
  function runIfSessionActive<T>(session: number, fn: () => T): T | undefined;
  function runIfSessionActive<T>(session: number, fn: () => T, fallback?: T): T | undefined {
    if (isBattleSessionActive(session)) {
      return fn();
    }
    return fallback;
  }

  function handleVictoryDefeat(kind: "victory" | "defeat") {
    const context = getContext();
    if (!context.victoryDefeatHandledRef.current) {
      context.victoryDefeatHandledRef.current = true;
      if (kind === "victory") context.onBattleVictory?.();
      else context.onBattleDefeat?.();
    }
  }

  function checkBattleEnd(state: BattleState, session: number): boolean {
    if (!isCurrentBattleSession(session)) return false;
    if (isPlayerDefeated(state)) {
      handleVictoryDefeat("defeat");
      return true;
    }
    if (state.enemyHealth <= 0) {
      handleVictoryDefeat("victory");
      return true;
    }
    return false;
  }

  function registerTransferCancelCallback(callback: () => void) {
    return getContext().transferCancelRegistryRef.current.register(callback);
  }

  function clearTransferHandles() {
    getContext().transferCancelRegistryRef.current.cancelAll();
  }

  function clearAllBattleTimeouts() {
    const context = getContext();
    context.battleTimerGroupRef.current.clearAll();
    context.companionScheduledRef.current = false;
  }

  function clearBattleTimeoutsKeepCompanion() {
    getContext().battleTimerGroupRef.current.clearAll();
  }

  function stopBattleFeedback() {
    stopAllSfx();
  }

  function resetBattleSession() {
    const context = getContext();
    context.battleSessionRef.current += 1;
    context.battleTimerGroupRef.current.clearAll();
    clearTransferHandles();
    stopBattleFeedback();
    context.cardPlayInProgressRef.current = false;
    context.victoryDefeatHandledRef.current = false;
    context.resolvedAsHasteOrStunRef.current = false;
    context.companionScheduledRef.current = false;
    getPresentationStore().clearRevealedCardKeys();
    getStore().setBattleStartState(null);
    getPresentationStore().resetPortraitHurtTokens();
  }

  function finishDrawSequence(
    session: number,
    state: BattleState,
    onComplete: (session: number, state: BattleState) => void,
  ) {
    runIfSessionActive(session, () => {
      getContext().cardPlayInProgressRef.current = false;
      onComplete(session, state);
    });
  }

  function getTurnResolutionStore() {
    const domain = getStore();
    const presentation = getPresentationStore();
    return {
      showCombatTexts: presentation.showCombatTexts.bind(presentation),
      setSyncedBattleState: domain.setSyncedBattleState.bind(domain),
      setDisplayOverrides: domain.setDisplayOverrides.bind(domain),
      shakeEnemy: presentation.shakeEnemy.bind(presentation),
      shakePlayer: presentation.shakePlayer.bind(presentation),
      hurtPlayer: presentation.hurtPlayer.bind(presentation),
      hurtEnemy: presentation.hurtEnemy.bind(presentation),
    };
  }

  return {
    isCurrentBattleSession,
    runIfSessionActive,
    handleVictoryDefeat,
    checkBattleEnd,
    registerTransferCancelCallback,
    clearTransferHandles,
    clearAllBattleTimeouts,
    clearBattleTimeoutsKeepCompanion,
    resetBattleSession,
    finishDrawSequence,
    getTurnResolutionStore,
  };
}
