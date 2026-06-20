// Card play, wish resolution, and post-play draw sequences in battle UI.
import type { MouseEvent, RefObject } from "react";
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
import { useAppStore } from "../../shared/stores/app-store";
import { CARD_ACTIVATION_ROTATION_DEGREES } from "@/lib/game-constants";
import { animateCardActivation } from "./card-transfer-animations";
import { getCardRect, getHoverId } from "../../shared/utils";
import { applyCombatTextPortraitFeedback, shouldPlayCardGoldGain } from "./battle-feedback";
import { getCardKey } from "./controller-utils";
import { runHandDrawSequence } from "./draw-sequence";
import { getBattleSessionStore } from "./battle-session";
import type { HandDrawSequenceDeps } from "./draw-sequence";
import type { Screen } from "../../shared/types";

const BATTLE_CARD_PLAY_OPTIONS: CardPlayOptions = { allowAfterEnemyDefeat: true };

export function createBattleCardPlay(params: {
  screen: Screen;
  runIfSessionActive: <T>(session: number, action: () => T, fallback?: T) => T;
  cardPlayInProgressRef: RefObject<boolean>;
  battleSessionRef: RefObject<number>;
  finishDrawSequence: (session: number, state: BattleState) => void;
  logBattleError: (context: string, err: unknown) => void;
  playerPanelRef: RefObject<HTMLDivElement | null>;
  enemyPanelRef: RefObject<HTMLDivElement | null>;
  battleSceneRef: RefObject<HTMLDivElement | null>;
  setHoveredCardId: React.Dispatch<React.SetStateAction<string | null>>;
  talents: { awardCardXP: (card: BattleCard) => void };
  getDrawSequenceDeps: () => HandDrawSequenceDeps;
  scheduleAutoEndTurn: (state: BattleState) => void;
}) {
  const getStore = () => getBattleSessionStore();

  function handleDrawSequence(
    oldHand: BattleCard[],
    newState: BattleState,
    applyState: () => void,
    session = params.battleSessionRef.current,
  ): Promise<boolean> {
    return runHandDrawSequence(oldHand, newState, applyState, session, params.getDrawSequenceDeps());
  }

  function runDrawSequenceAndFinalize(
    oldHand: BattleCard[],
    newState: BattleState,
    onCommitState: () => void,
    session: number,
    errorContext: string,
  ) {
    void handleDrawSequence(oldHand, newState, onCommitState, session)
      .catch((err: unknown) => params.logBattleError(`handle ${errorContext} draw sequence`, err))
      .finally(() => params.finishDrawSequence(session, newState));
  }

  function canPlayCard(card: BattleCard, index: number, state: BattleState) {
    const hiddenKeys = getStore().hiddenHandCardKeys;
    return (
      params.screen === "battle" &&
      canPlayCardInBattle(state, card, index, BATTLE_CARD_PLAY_OPTIONS) &&
      !params.cardPlayInProgressRef.current &&
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
      params.playerPanelRef,
      params.enemyPanelRef,
      params.battleSceneRef,
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
    const session = params.battleSessionRef.current;
    params.cardPlayInProgressRef.current = true;
    animatePlayedCard(card, index, sourceRect);
    playCardSound(card.id);
    const resolution = playBattleCardResolved(currentState, card.id, index, BATTLE_CARD_PLAY_OPTIONS);
    playCardResolutionFeedback(card, currentState, resolution.state, resolution.combatTexts);
    params.setHoveredCardId((current) => (current === getHoverId("hand", `${card.id}-${card.uid}`) ? null : current));
    params.talents.awardCardXP(card);

    runDrawSequenceAndFinalize(
      currentState.hand,
      resolution.state,
      () => {
        getStore().setSyncedBattleState(resolution.state);
        if (resolution.combatTexts.length > 0) getStore().showCombatTexts(resolution.combatTexts);
      },
      session,
      "play card",
    );
    params.runIfSessionActive(session, () => {
      params.scheduleAutoEndTurn(resolution.state);
    });
  }

  function handleCardClick(card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) {
    handlePlayCard(card, index, getCardRect(event.currentTarget.getBoundingClientRect()));
  }

  function handleWishChoice(cardOrNull: BattleCard | null) {
    const currentState = getStore().battleState;
    const newState = chooseWishCard(currentState, cardOrNull?.id ?? null);
    const session = params.battleSessionRef.current;
    if (cardOrNull) {
      useAppStore.getState().setDiscoveredCardIds((current) => appendUnique(current, cardOrNull.id));
    }
    runDrawSequenceAndFinalize(
      currentState.hand,
      newState,
      () => {
        getStore().setSyncedBattleState(newState);
      },
      session,
      "wish choice",
    );
  }

  return { handleCardClick, handleWishChoice };
}
