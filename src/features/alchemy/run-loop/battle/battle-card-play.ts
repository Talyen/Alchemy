import { useUiStore, isBattleInspectionOpen } from "../../shared/stores/ui-store";
import type { MouseEvent } from "react";
import {
  canPlayCard as canPlayCardInBattle,
  computeCardPayment,
  isAttackCard,
  type BattleSnapshot,
} from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
import { playCardSound, playBattleEvent, playUISound } from "@/lib/audio";
import { AUTOPLAY_PREVIEW_MS, CARD_ACTIVATION_ROTATION_DEGREES } from "@/lib/game-constants";
import { shouldReduceMotion } from "@/lib/animation/animation-prefs";
import { resolveGameDelay } from "@/lib/animation/game-timer";
import { animateCardActivation } from "./card-transfer-animations";
import { getCardRect, getHoverId } from "../../shared/utils";
import { presentCombatTexts } from "./controller-utils";
import { PLAYABLE_HAND_OPTIONS, getHandCardKey } from "./playable-hand";
import { runBattleDraw } from "./draw-sequence";
import { type createBattleSession } from "./battle-session";
import type { createBattleTransferDeps } from "./battle-transfers";
import type { AutoplayCardControl, BattleControllerContext } from "./battle-context";

export function createBattleCardPlay(
  ctx: BattleControllerContext,
  session: ReturnType<typeof createBattleSession>,
  transferDeps: ReturnType<typeof createBattleTransferDeps>,
) {
  let autoplayPreviewSequence = 0;
  const getBattle = () => ctx.battle.read();
  const getPresentation = () => ctx.getPresentation();

  function finishDrawSequence(sessionNum: number) {
    if (ctx.playback.pendingCardDraws > 0) return;
    session.runIfSessionActive(sessionNum, () => {
      ctx.playback.completeAction(sessionNum);
      // The inner draw settled while this card action still owned a draw count.
      // Publish the final gate only after releasing that outer ownership.
      getPresentation().setCardTransferInProgress(ctx.playback.pendingDraws > 0);
      const state = getBattle().battleState;
      ctx.playback.scheduleAutoEndTurn(state);
    });
  }

  function runDrawSequenceAndFinalize(
    oldHand: BattleCard[],
    newState: BattleSnapshot,
    onReveal: () => void,
    sessionNum: number,
    errorContext: string,
  ) {
    const finishDraw = ctx.playback.beginDraw(sessionNum, "card");
    ctx.playback.beginAction();
    void runBattleDraw({
      oldHand,
      newState,
      onReveal: onReveal,
      session: sessionNum,
      deps: transferDeps.getDrawSequenceDeps(sessionNum),
      errorContext: `handle ${errorContext} draw sequence`,
      onSettled: () => {
        finishDraw();
        finishDrawSequence(sessionNum);
      },
    });
  }

  function canAcceptCardInput(card: BattleCard, index: number, state: BattleSnapshot) {
    const presentation = getPresentation();
    return (
      !isBattleInspectionOpen(useUiStore.getState()) &&
      !presentation.endTurnConfirmationOpen &&
      ctx.screen === "battle" &&
      ctx.playback.canAcceptInput(true) &&
      state.turnPhase === "player" &&
      !state.wishOptions &&
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

  // A stale autoplay preview must never linger past the play it teased (manual takeover included).
  function clearStaleAutoplayPreview() {
    useUiStore.getState().setAutoplayPreviewCardId(null);
  }

  // Shared autoplay skeleton: gate → preview → re-gate → commit → clear.
  // Card and Wish branches differ only in preview id and commit fn.
  async function runAutoplayWithPreview(
    control: AutoplayCardControl,
    previewId: string,
    commit: (expected: BattleSnapshot) => boolean | Promise<boolean>,
  ): Promise<boolean> {
    const sessionNum = ctx.playback.id;
    const expected = getBattle().battleState;
    if (!ctx.playback.isCurrent(sessionNum) || control.signal.aborted || !control.canCommit()) return false;
    const clearPreview = await previewAutoplayChoice(control, previewId);
    try {
      if (!ctx.playback.isCurrent(sessionNum) || control.signal.aborted || !control.canCommit()) return false;
      return await commit(expected);
    } finally {
      clearPreview();
    }
  }

  function handlePlayCard(
    card: BattleCard,
    index: number,
    sourceRect: { x: number; y: number; width: number; height: number },
    expected: BattleSnapshot,
    options?: { silentReject?: boolean },
  ): boolean {
    clearStaleAutoplayPreview();
    const currentState = getBattle().battleState;
    if (currentState !== expected) return false;
    if (card.uid !== undefined) {
      index = currentState.hand.findIndex((candidate) => candidate.uid === card.uid && candidate.id === card.id);
    }
    if (!canAcceptCardInput(card, index, currentState)) return false;
    const handCard = currentState.hand[index];
    // Stale clicks and playback locks are silent; deliberate rule rejections are visible.
    if (!handCard || handCard.id !== card.id) return false;
    if (!canPlayCardInBattle(currentState, handCard, index, PLAYABLE_HAND_OPTIONS)) {
      if (
        !options?.silentReject &&
        getPresentation().rejectCardPlay(
          getHandCardKey(handCard, index),
          !computeCardPayment(currentState, handCard).affordable,
        )
      )
        playUISound("error");
      return false;
    }
    const sessionNum = ctx.playback.id;
    const played = ctx.battle.playCard(currentState, index, card.id);
    if (!played) {
      if (!options?.silentReject) playUISound("error");
      return false;
    }
    getPresentation().setDisplayedBattle(null);
    session.checkBattleEnd(played.state, sessionNum);
    ctx.playback.beginAction();
    if (isAttackCard(card)) {
      getPresentation().telegraphAttack("player");
    } else {
      getPresentation().telegraphCast("player");
    }
    animatePlayedCard(card, index, sourceRect, currentState.hand.length);
    const focalSound = playCardSound(card.id);
    if (!currentState.deathsDoorActive && played.state.deathsDoorActive) playBattleEvent("deathsDoor");
    ctx.setHoveredCardId((current) => (current === getHoverId("hand", getHandCardKey(card, index)) ? null : current));

    runDrawSequenceAndFinalize(
      currentState.hand,
      played.state,
      () => {
        presentCombatTexts(getPresentation(), played.combatTexts, focalSound);
      },
      sessionNum,
      "play card",
    );
    return true;
  }

  function handleCardClick(card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) {
    handlePlayCard(card, index, getCardRect(event.currentTarget.getBoundingClientRect()), getBattle().battleState);
  }

  // Flash the hover treatment before committing so autoplay reads like a manual
  // play. Returns a cleanup that only clears the preview it set.
  async function previewAutoplayChoice(control: AutoplayCardControl, previewId: string): Promise<() => void> {
    const sequence = ++autoplayPreviewSequence;
    const clearPreview = () => {
      const ui = useUiStore.getState();
      // An abandoned invocation must not clear a newer preview of the same card.
      if (sequence === autoplayPreviewSequence && ui.autoplayPreviewCardId === previewId) {
        ui.setAutoplayPreviewCardId(null);
      }
    };
    if (!shouldReduceMotion()) {
      const battleSignal = ctx.playback.signal;
      const ui = useUiStore.getState();
      ui.setAutoplayPreviewCardId(previewId);
      ui.maybeTriggerShimmer(previewId);
      await new Promise<void>((resolve) => {
        const finish = () => {
          clearTimeout(timer);
          control.signal.removeEventListener("abort", finish);
          battleSignal.removeEventListener("abort", finish);
          if (control.signal.aborted || battleSignal.aborted) clearPreview();
          resolve();
        };
        const timer = setTimeout(finish, resolveGameDelay(AUTOPLAY_PREVIEW_MS));
        control.signal.addEventListener("abort", finish, { once: true });
        battleSignal.addEventListener("abort", finish, { once: true });
        if (control.signal.aborted || battleSignal.aborted) finish();
      });
    }
    return clearPreview;
  }

  async function handleAutoplayCard(card: BattleCard, index: number, control: AutoplayCardControl): Promise<boolean> {
    const previewId = getHoverId("hand", getHandCardKey(card, index));
    return runAutoplayWithPreview(control, previewId, (expected) => {
      // Measure after the preview so the ghost starts from the lifted position, like a manual play.
      const element = ctx.handCardRefs.current[getHandCardKey(card, index)];
      const sourceRect = element ? getCardRect(element.getBoundingClientRect()) : { x: 0, y: 0, width: 0, height: 0 };
      return handlePlayCard(card, index, sourceRect, expected, { silentReject: true });
    });
  }

  function commitWishChoice(card: BattleCard, errorContext: string, expected: BattleSnapshot): boolean {
    const currentState = getBattle().battleState;
    if (currentState !== expected) return false;
    if (!currentState.wishOptions?.some((option) => option.id === card.id)) return false;
    const newState = ctx.battle.chooseWish(expected, card.id);
    if (!newState) return false;
    playUISound("selection");
    const sessionNum = ctx.playback.id;
    session.checkBattleEnd(newState, sessionNum);
    runDrawSequenceAndFinalize(currentState.hand, newState, () => {}, sessionNum, errorContext);
    return true;
  }

  async function handleAutoplayWish(card: BattleCard, control: AutoplayCardControl): Promise<boolean> {
    return runAutoplayWithPreview(control, getHoverId("wish", card.id), (expected) =>
      commitWishChoice(card, "autoplay wish choice", expected),
    );
  }

  function handleWishChoice(card: BattleCard) {
    clearStaleAutoplayPreview();
    commitWishChoice(card, "wish choice", getBattle().battleState);
  }

  return { handleCardClick, handleWishChoice, handleAutoplayCard, handleAutoplayWish };
}
