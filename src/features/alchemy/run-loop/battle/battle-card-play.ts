// Card play, wish resolution, and post-play draw sequences in battle UI.
import type { MouseEvent, RefObject } from "react";
import {
  canPlayCard as canPlayCardInBattle,
  chooseWishCard,
  playBattleCardResolved,
  type BattleState,
  type CombatTextEvent,
} from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
import { playCardSound, playGoldGain } from "@/lib/audio";
import { appendUnique } from "@/lib/utils";
import { CARD_ACTIVATION_ROTATION_DEGREES } from "@/lib/game-constants";
import { animateCardActivation } from "./card-ghost-animation";
import type { Screen } from "../../shared/types";
import { getCardRect, getHoverId } from "../../shared/utils";
import type { TalentStateController } from "../../shared/stores/run-store";
import { applyCombatTextPortraitFeedback, shouldPlayCardGoldGain } from "./battle-feedback";
import { getCardKey } from "./controller-utils";
import { runHandDrawSequence, type HandDrawSequenceDeps } from "./draw-sequence";
import { getBattleSessionStore } from "./battle-store-access";

export type BattleCardPlayDeps = {
  screen: Screen;
  battleState: BattleState;
  battleSessionRef: RefObject<number>;
  cardPlayInProgressRef: RefObject<boolean>;
  hiddenHandCardKeys: Set<string>;
  playerPanelRef: RefObject<HTMLDivElement | null>;
  enemyPanelRef: RefObject<HTMLDivElement | null>;
  battleSceneRef: RefObject<HTMLDivElement | null>;
  setHoveredCardId: React.Dispatch<React.SetStateAction<string | null>>;
  talents: TalentStateController;
  setDiscoveredCardIds: React.Dispatch<React.SetStateAction<string[]>>;
  getDrawSequenceDeps: () => HandDrawSequenceDeps;
  finishDrawSequence: (session: number, state: BattleState) => void;
  runIfSessionActive: (session: number, action: () => void) => void;
  scheduleAutoEndTurn: (state: BattleState) => void;
  logBattleError: (context: string, err: unknown) => void;
};

export function createBattleCardPlay(deps: BattleCardPlayDeps) {
  const getStore = () => getBattleSessionStore();

  function handleDrawSequence(
    oldHand: BattleCard[],
    newState: BattleState,
    applyState: () => void,
    session = deps.battleSessionRef.current,
  ): Promise<boolean> {
    return runHandDrawSequence(oldHand, newState, applyState, session, deps.getDrawSequenceDeps());
  }

  function runDrawSequenceAndFinalize(
    oldHand: BattleCard[],
    newState: BattleState,
    onCommitState: () => void,
    session: number,
    errorContext: string,
  ) {
    void handleDrawSequence(oldHand, newState, onCommitState, session)
      .catch((err) => deps.logBattleError(`handle ${errorContext} draw sequence`, err))
      .finally(() => deps.finishDrawSequence(session, newState));
  }

  function canPlayCard(card: BattleCard, index: number, state: BattleState) {
    return (
      deps.screen === "battle" &&
      canPlayCardInBattle(state, card, index) &&
      !deps.cardPlayInProgressRef.current &&
      !deps.hiddenHandCardKeys.has(getCardKey(card))
    );
  }

  function animatePlayedCard(
    card: BattleCard,
    index: number,
    sourceRect: { x: number; y: number; width: number; height: number },
  ) {
    const centerOffset = index - (deps.battleState.hand.length - 1) / 2;
    animateCardActivation(
      card,
      sourceRect,
      centerOffset * CARD_ACTIVATION_ROTATION_DEGREES,
      deps.playerPanelRef,
      deps.enemyPanelRef,
      deps.battleSceneRef,
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
    if (!canPlayCard(card, index, currentState)) return;
    const session = deps.battleSessionRef.current;
    deps.cardPlayInProgressRef.current = true;
    animatePlayedCard(card, index, sourceRect);
    playCardSound(card.id);
    const resolution = playBattleCardResolved(currentState, card.id, index);
    playCardResolutionFeedback(card, currentState, resolution.state, resolution.combatTexts);
    deps.setHoveredCardId((current) => (current === getHoverId("hand", `${card.id}-${card.uid}`) ? null : current));
    deps.talents.awardCardXP(card);

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
    deps.runIfSessionActive(session, () => {
      deps.scheduleAutoEndTurn(resolution.state);
    });
  }

  function handleCardClick(card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) {
    handlePlayCard(card, index, getCardRect(event.currentTarget.getBoundingClientRect()));
  }

  function handleWishChoice(cardOrNull: BattleCard | null) {
    const currentState = getStore().battleState;
    const newState = chooseWishCard(currentState, cardOrNull?.id ?? null);
    const session = deps.battleSessionRef.current;
    if (cardOrNull) {
      deps.setDiscoveredCardIds((current) => appendUnique(current, cardOrNull.id));
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
