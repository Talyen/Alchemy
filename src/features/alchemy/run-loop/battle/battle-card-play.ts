import { useUiStore } from "../../shared/stores/ui-store";
import type { MouseEvent } from "react";
import {
  canPlayCard as canPlayCardInBattle,
  chooseWishCard,
  isAttackCard,
  playBattleCardResolved,
  type BattleState,
  type CombatTextEvent,
} from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
import { playCardSound, playGoldGain, playUISound } from "@/lib/audio";
import { CARD_ACTIVATION_ROTATION_DEGREES } from "@/lib/game-constants";
import { animateCardActivation } from "./card-transfer-animations";
import { getCardRect, getHoverId } from "../../shared/utils";
import { applyCombatTextShakeFeedback, shouldPlayCardGoldGain } from "./battle-status";
import { playCombatTextSounds } from "./controller-utils";
import { PLAYABLE_HAND_OPTIONS, getHandCardKey } from "./playable-hand";
import { runBattleDraw } from "./draw-sequence";
import { type createBattleSession } from "./battle-session";
import type { createBattleTransferDeps } from "./battle-transfer-deps";
import type { BattleControllerContext } from "./battle-context";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  awardCardXP,
  setBattleState,
  withDraftWorldBattleRng,
  withRestingWorldBattleRng,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import { discoverCardIds } from "../../shared/stores/profile-store";

export function createBattleCardPlay(
  ctx: BattleControllerContext,
  session: ReturnType<typeof createBattleSession>,
  transferDeps: ReturnType<typeof createBattleTransferDeps>,
) {
  const getBattle = () => readBattle();
  const getPresentation = () => ctx.getPresentation();

  const pendingDraws = new Map<number, number>();

  function finishDrawSequence(sessionNum: number) {
    const remaining = (pendingDraws.get(sessionNum) ?? 1) - 1;
    if (remaining > 0) {
      pendingDraws.set(sessionNum, remaining);
      return;
    }
    pendingDraws.delete(sessionNum);
    session.runIfSessionActive(sessionNum, () => {
      ctx.cardPlayInProgressRef.current = false;
      const state = getBattle().battleState;
      session.checkBattleEnd(state, sessionNum);
      ctx.scheduleAutoEndTurnRef.current?.(state);
    });
  }

  function runDrawSequenceAndFinalize(
    oldHand: BattleCard[],
    newState: BattleState,
    onCommitState: () => void,
    sessionNum: number,
    errorContext: string,
  ) {
    pendingDraws.set(sessionNum, (pendingDraws.get(sessionNum) ?? 0) + 1);
    ctx.cardPlayInProgressRef.current = true;
    void runBattleDraw({
      oldHand,
      newState,
      applyState: onCommitState,
      session: sessionNum,
      deps: transferDeps.getDrawSequenceDeps(),
      errorContext: `handle ${errorContext} draw sequence`,
      onSettled: () => finishDrawSequence(sessionNum),
    });
  }

  function canPlayCard(card: BattleCard, index: number, state: BattleState) {
    const presentation = getPresentation();
    return (
      useUiStore.getState().cardInspection === null &&
      ctx.screen === "battle" &&
      (!ctx.cardPlayInProgressRef.current || (pendingDraws.get(ctx.battleSessionRef.current) ?? 0) > 0) &&
      canPlayCardInBattle(state, card, index, PLAYABLE_HAND_OPTIONS) &&
      !presentation.hiddenHandCardKeys.includes(getHandCardKey(card, index))
    );
  }

  function animatePlayedCard(
    card: BattleCard,
    index: number,
    sourceRect: { x: number; y: number; width: number; height: number },
    handLength: number,
  ) {
    const centerOffset = index - (handLength - 1) / 2;
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
    applyCombatTextShakeFeedback(combatTexts, getPresentation());
    playCombatTextSounds(combatTexts);
  }

  function handlePlayCard(
    card: BattleCard,
    index: number,
    sourceRect: { x: number; y: number; width: number; height: number },
    options?: { silentReject?: boolean },
  ): boolean {
    const currentState = getBattle().battleState;
    if (card.uid !== undefined) {
      index = currentState.hand.findIndex((candidate) => candidate.uid === card.uid && candidate.id === card.id);
    }
    if (!canPlayCard(card, index, currentState)) {
      if (!options?.silentReject) playUISound("error");
      return false;
    }
    const sessionNum = ctx.battleSessionRef.current;
    const played = dispatchRunSessionCommand((draft) => {
      const bound = withDraftWorldBattleRng(draft, currentState);
      if (!canPlayCard(card, index, bound)) return null;
      const resolution = playBattleCardResolved(bound, card.id, index, PLAYABLE_HAND_OPTIONS);
      setBattleState(draft, resolution.state);
      awardCardXP(draft, card);
      return { ...resolution, state: withRestingWorldBattleRng(resolution.state) };
    });
    if (!played) {
      if (!options?.silentReject) playUISound("error");
      return false;
    }
    ctx.cardPlayInProgressRef.current = true;
    if (isAttackCard(card)) {
      getPresentation().telegraphAttack("player");
    } else {
      getPresentation().telegraphCast("player");
    }
    animatePlayedCard(card, index, sourceRect, currentState.hand.length);
    playCardSound(card.id);
    ctx.setHoveredCardId((current) => (current === getHoverId("hand", getHandCardKey(card, index)) ? null : current));

    runDrawSequenceAndFinalize(
      currentState.hand,
      played.state,
      () => {
        playCardResolutionFeedback(card, currentState, played.state, played.combatTexts);
        if (played.combatTexts.length > 0) {
          getPresentation().showCombatTexts(played.combatTexts);
        }
      },
      sessionNum,
      "play card",
    );
    return true;
  }

  function handleCardClick(card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) {
    handlePlayCard(card, index, getCardRect(event.currentTarget.getBoundingClientRect()));
  }

  function handleAutoplayCard(card: BattleCard, index: number): boolean {
    const element = ctx.handCardRefs.current[getHandCardKey(card, index)];
    const sourceRect = element ? getCardRect(element.getBoundingClientRect()) : { x: 0, y: 0, width: 0, height: 0 };
    return handlePlayCard(card, index, sourceRect, { silentReject: true });
  }

  function handleWishChoice(card: BattleCard) {
    const currentState = getBattle().battleState;
    if (!currentState.wishOptions) return;
    const newState = dispatchRunSessionCommand((draft) => {
      const bound = withDraftWorldBattleRng(draft, currentState);
      if (!bound.wishOptions?.some((option) => option.id === card.id)) return null;
      const next = chooseWishCard(bound, card.id);
      setBattleState(draft, next);
      discoverCardIds(draft, [card.id]);
      return withRestingWorldBattleRng(next);
    });
    if (!newState) return;
    const sessionNum = ctx.battleSessionRef.current;
    runDrawSequenceAndFinalize(currentState.hand, newState, () => {}, sessionNum, "wish choice");
  }

  return { handleCardClick, handleWishChoice, handleAutoplayCard };
}
