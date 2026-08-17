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
import { CARD_ACTIVATION_ROTATION_DEGREES } from "@/lib/game-constants";
import { animateCardActivation } from "./card-transfer-animations";
import { getCardRect, getHoverId } from "../../shared/utils";
import { applyCombatTextPortraitFeedback, shouldPlayCardGoldGain } from "./battle-feedback";
import { getCardKey, playCombatTextSounds } from "./controller-utils";
import { runHandDrawSequence } from "./draw-sequence";
import { type createBattleSession } from "./battle-session";
import type { createBattleTransferDeps } from "./battle-transfer-deps";
import type { BattleControllerContext } from "./battle-context";
import { logError } from "@/lib/error-logger";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setBattleState } from "@/features/alchemy/shared/stores/run-session-write-port";
import { readBattle } from "@/features/alchemy/shared/stores/run-session-read-port";
import { discoverCardIds } from "../run/deck-mutations";

const BATTLE_CARD_PLAY_OPTIONS: CardPlayOptions = { allowAfterEnemyDefeat: true };

export function createBattleCardPlay(
  ctx: BattleControllerContext,
  session: ReturnType<typeof createBattleSession>,
  transferDeps: ReturnType<typeof createBattleTransferDeps>,
) {
  const getBattle = () => readBattle();
  const getPresentation = () => ctx.getPresentation();

  const logBattleError = (context: string, err: unknown) => {
    logError(`Failed to ${context}`, "battle", { error: String(err) }, err instanceof Error ? err.stack : undefined);
  };

  function finishDrawSequence(sessionNum: number, state: BattleState) {
    session.finishDrawSequence(sessionNum, state, () => {
      getPresentation().resetHandTransferUi();
      session.checkBattleEnd(state, sessionNum);
      ctx.scheduleAutoEndTurnRef.current?.(state);
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
    const hiddenKeys = getPresentation().hiddenHandCardKeys;
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
    const centerOffset = index - (getBattle().battleState.hand.length - 1) / 2;
    animateCardActivation(
      card,
      sourceRect,
      centerOffset * CARD_ACTIVATION_ROTATION_DEGREES,
      ctx.playerPanelRef,
      ctx.enemyPanelRef,
      ctx.battleSceneRef,
      getPresentation().spawnCardGhost,
    );
  }

  function playCardResolutionFeedback(
    card: BattleCard,
    prePlayState: BattleState,
    postPlayState: BattleState,
    combatTexts: CombatTextEvent[],
  ) {
    if (shouldPlayCardGoldGain(prePlayState, postPlayState, card)) playGoldGain();
    applyCombatTextPortraitFeedback(combatTexts, getPresentation());
    playCombatTextSounds(combatTexts);
  }

  function handlePlayCard(
    card: BattleCard,
    index: number,
    sourceRect: { x: number; y: number; width: number; height: number },
    options?: { silentReject?: boolean },
  ): boolean {
    const currentState = getBattle().battleState;
    if (!canPlayCard(card, index, currentState)) {
      if (!options?.silentReject) playUISound("error");
      return false;
    }
    const sessionNum = ctx.battleSessionRef.current;
    ctx.cardPlayInProgressRef.current = true;
    animatePlayedCard(card, index, sourceRect);
    playCardSound(card.id);
    const resolution = playBattleCardResolved(currentState, card.id, index, BATTLE_CARD_PLAY_OPTIONS);
    ctx.setHoveredCardId((current) => (current === getHoverId("hand", `${card.id}-${card.uid}`) ? null : current));

    runDrawSequenceAndFinalize(
      currentState.hand,
      resolution.state,
      () => {
        dispatchRunSessionCommand(
          (draft) => {
            setBattleState(draft, resolution.state);
            ctx.talents.awardCardXP(draft, card);
          },
          {
            afterCommit: () => {
              playCardResolutionFeedback(card, currentState, resolution.state, resolution.combatTexts);
              if (resolution.combatTexts.length > 0) getPresentation().showCombatTexts(resolution.combatTexts);
            },
          },
        );
      },
      sessionNum,
      "play card",
    );
    session.runIfSessionActive(sessionNum, () => {
      ctx.scheduleAutoEndTurnRef.current?.(resolution.state);
    });
    return true;
  }

  function handleCardClick(card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) {
    handlePlayCard(card, index, getCardRect(event.currentTarget.getBoundingClientRect()));
  }

  function handleAutoplayCard(card: BattleCard, index: number): boolean {
    const element = ctx.handCardRefs.current[getCardKey(card)];
    if (!element) return false;
    return handlePlayCard(card, index, getCardRect(element.getBoundingClientRect()), { silentReject: true });
  }

  function handleWishChoice(cardOrNull: BattleCard | null) {
    const currentState = getBattle().battleState;
    if (!currentState.wishOptions) return;
    const newState = chooseWishCard(currentState, cardOrNull?.id ?? null);
    const sessionNum = ctx.battleSessionRef.current;
    runDrawSequenceAndFinalize(
      currentState.hand,
      newState,
      () => {
        dispatchRunSessionCommand((draft) => {
          setBattleState(draft, newState);
          if (cardOrNull) discoverCardIds(draft, [cardOrNull.id]);
        });
      },
      sessionNum,
      "wish choice",
    );
  }

  return { handleCardClick, handleWishChoice, handleAutoplayCard };
}
