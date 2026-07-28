// Card play, wish resolution, and post-play draw sequences in battle UI.
import type { MouseEvent } from "react";
import {
  canPlayCard as canPlayCardInBattle,
  chooseWishCard,
  playBattleCardResolved,
  type BattleState,
  type CardPlayOptions,
  type CombatTextEvent,
} from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
import { playCardSound, playGoldGain, playUISound } from "@/lib/audio";
import { appendUnique } from "@/lib/utils";
import { useProfileStore } from "../../shared/stores/profile-store";
import { CARD_ACTIVATION_ROTATION_DEGREES } from "@/lib/game-constants";
import { animateCardActivation } from "./card-transfer-animations";
import { getCardRect, getHoverId } from "../../shared/utils";
import { applyCombatTextPortraitFeedback, shouldPlayCardGoldGain } from "./battle-feedback";
import { getCardKey } from "./controller-utils";
import { runHandDrawSequence } from "./draw-sequence";
import { getBattleSessionStore, type createBattleSession } from "./battle-session";
import type { createBattleTransferDeps } from "./battle-transfer-deps";
import type { BattleControllerContext } from "./battle-context";
import { logError } from "@/lib/error-logger";
import { useBattlePresentationStore } from "./battle-presentation-store";

const BATTLE_CARD_PLAY_OPTIONS: CardPlayOptions = { allowAfterEnemyDefeat: true };

export function createBattleCardPlay(
  ctx: BattleControllerContext,
  session: ReturnType<typeof createBattleSession>,
  transferDeps: ReturnType<typeof createBattleTransferDeps>,
) {
  const getStore = () => getBattleSessionStore();

  const logBattleError = (context: string, err: unknown) => {
    logError(`Failed to ${context}`, "battle", { error: String(err) }, err instanceof Error ? err.stack : undefined);
  };

  function finishDrawSequence(sessionNum: number, state: BattleState) {
    session.finishDrawSequence(sessionNum, state, () => {
      useBattlePresentationStore.getState().resetHandTransferUi();
      session.checkBattleEnd(state, sessionNum);
    });
  }

  function handleDrawSequence(
    oldHand: BattleCard[],
    newState: BattleState,
    applyState: () => void,
    sessionNum = ctx.battleSessionRef.current,
  ): Promise<boolean> {
    return runHandDrawSequence(oldHand, newState, applyState, sessionNum, transferDeps.getDrawSequenceDeps());
  }

  function runDrawSequenceAndFinalize(
    oldHand: BattleCard[],
    newState: BattleState,
    onCommitState: () => void,
    sessionNum: number,
    errorContext: string,
  ) {
    void handleDrawSequence(oldHand, newState, onCommitState, sessionNum)
      .catch((err: unknown) => logBattleError(`handle ${errorContext} draw sequence`, err))
      .finally(() => finishDrawSequence(sessionNum, newState));
  }

  function canPlayCard(card: BattleCard, index: number, state: BattleState) {
    const hiddenKeys = getStore().hiddenHandCardKeys;
    return (
      ctx.screen === "battle" &&
      canPlayCardInBattle(state, card, index, BATTLE_CARD_PLAY_OPTIONS) &&
      !ctx.cardPlayInProgressRef.current &&
      !hiddenKeys.has(getCardKey(card))
    );
  }

  function animatePlayedCard(
    card: BattleCard,
    index: number,
    sourceRect: { x: number; y: number; width: number; height: number },
  ) {
    const centerOffset = index - (getStore().battleState.hand.length - 1) / 2;
    animateCardActivation(
      card,
      sourceRect,
      centerOffset * CARD_ACTIVATION_ROTATION_DEGREES,
      ctx.playerPanelRef,
      ctx.enemyPanelRef,
      ctx.battleSceneRef,
      getStore().spawnCardGhost,
    );
  }

  function playCardResolutionFeedback(
    card: BattleCard,
    prePlayState: BattleState,
    postPlayState: BattleState,
    combatTexts: CombatTextEvent[],
  ) {
    if (shouldPlayCardGoldGain(prePlayState, postPlayState, card)) playGoldGain();
    const store = getStore();
    applyCombatTextPortraitFeedback(combatTexts, store);
  }

  function handlePlayCard(
    card: BattleCard,
    index: number,
    sourceRect: { x: number; y: number; width: number; height: number },
  ) {
    const currentState = getStore().battleState;
    if (!canPlayCard(card, index, currentState)) {
      playUISound("error");
      return;
    }
    const sessionNum = ctx.battleSessionRef.current;
    ctx.cardPlayInProgressRef.current = true;
    animatePlayedCard(card, index, sourceRect);
    playCardSound(card.id);
    const resolution = playBattleCardResolved(currentState, card.id, index, BATTLE_CARD_PLAY_OPTIONS);
    playCardResolutionFeedback(card, currentState, resolution.state, resolution.combatTexts);
    ctx.setHoveredCardId((current) => (current === getHoverId("hand", `${card.id}-${card.uid}`) ? null : current));
    ctx.talents.awardCardXP(card);

    runDrawSequenceAndFinalize(
      currentState.hand,
      resolution.state,
      () => {
        getStore().setSyncedBattleState(resolution.state);
        if (resolution.combatTexts.length > 0) getStore().showCombatTexts(resolution.combatTexts);
      },
      sessionNum,
      "play card",
    );
    session.runIfSessionActive(sessionNum, () => {
      ctx.scheduleAutoEndTurnRef.current?.(resolution.state);
    });
  }

  function handleCardClick(card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) {
    handlePlayCard(card, index, getCardRect(event.currentTarget.getBoundingClientRect()));
  }

  function handleWishChoice(cardOrNull: BattleCard | null) {
    const currentState = getStore().battleState;
    if (!currentState.wishOptions) return;
    const newState = chooseWishCard(currentState, cardOrNull?.id ?? null);
    const sessionNum = ctx.battleSessionRef.current;
    if (cardOrNull) {
      useProfileStore.getState().setDiscoveredCardIds((current) => appendUnique(current, cardOrNull.id));
    }
    runDrawSequenceAndFinalize(
      currentState.hand,
      newState,
      () => {
        getStore().setSyncedBattleState(newState);
      },
      sessionNum,
      "wish choice",
    );
  }

  return { handleCardClick, handleWishChoice };
}
