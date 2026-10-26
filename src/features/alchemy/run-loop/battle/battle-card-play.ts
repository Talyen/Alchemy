import { useUiStore, isBattleInspectionOpen } from "../../shared/stores/react/ui-store";
import type { MouseEvent } from "react";
import {
  canPlayCard as canPlayCardInBattle,
  computeCardPayment,
  isAttackCard,
  getBattleCardAnimationTarget,
  type BattleSnapshot,
} from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
import { playUISound } from "@/lib/audio";
import { AUTOPLAY_PREVIEW_MS, CARD_ACTIVATION_ROTATION_DEGREES } from "@/lib/game-constants";
import { shouldReduceMotion } from "@/lib/animation/animation-prefs";
import { animateCardActivation } from "./card-transfer-animations";
import { getCardRect, getHoverId } from "../../shared/utils";
import { playResolvedCardSound, presentCombatTexts } from "./controller-utils";
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
    if (!ctx.playback.isCurrent(sessionNum)) return;
    if (!ctx.playback.finishing && !ctx.playback.beginAction(sessionNum)) return;
    const finishDraw = ctx.playback.beginDraw(sessionNum, "card");
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
      ctx.screen === "battle" &&
      ctx.playback.canPlayCard() &&
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
    target: "player" | "enemy",
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
      target,
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
    expected: BattleSnapshot,
    commit: (expected: BattleSnapshot) => boolean | Promise<boolean>,
  ): Promise<boolean> {
    const sessionNum = ctx.playback.id;
    if (
      expected !== getBattle().battleState ||
      !ctx.playback.isCurrent(sessionNum) ||
      control.signal.aborted ||
      !control.canCommit()
    )
      return false;
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
    const currentState = getBattle().battleState;
    if (currentState !== expected) return false;
    clearStaleAutoplayPreview();
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
    const animationTarget = getBattleCardAnimationTarget(handCard, currentState);
    const played = ctx.battle.playCard(currentState, index, card.id);
    if (!played) {
      if (!options?.silentReject) playUISound("error");
      return false;
    }
    getPresentation().setDisplayedBattle(null);
    session.checkBattleEnd(played.state, sessionNum);
    if (!ctx.playback.isCurrent(sessionNum)) return true;
    // Victory grace permits the accepted card feedback while finishing.
    if (!ctx.playback.finishing && !ctx.playback.beginAction(sessionNum)) return true;
    if (isAttackCard(card)) {
      getPresentation().telegraphAttack("player");
    } else {
      getPresentation().telegraphCast("player");
    }
    animatePlayedCard(card, index, sourceRect, currentState.hand.length, animationTarget);
    const focalSound = playResolvedCardSound(
      card.id,
      played.combatTexts,
      !currentState.deathsDoorActive && played.state.deathsDoorActive,
    );
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

  function handleCardClick(
    card: BattleCard,
    index: number,
    event: MouseEvent<HTMLButtonElement>,
    expected: BattleSnapshot,
  ) {
    handlePlayCard(card, index, getCardRect(event.currentTarget.getBoundingClientRect()), expected);
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
      const scope = ctx.playback.capture(ctx.playback.id);
      const ui = useUiStore.getState();
      ui.setAutoplayPreviewCardId(previewId);
      ui.maybeTriggerShimmer(previewId);
      if (!(await scope.wait(AUTOPLAY_PREVIEW_MS, control.signal, clearPreview))) clearPreview();
    }
    return clearPreview;
  }

  async function handleAutoplayCard(
    card: BattleCard,
    index: number,
    control: AutoplayCardControl,
    expected: BattleSnapshot,
  ): Promise<boolean> {
    const previewId = getHoverId("hand", getHandCardKey(card, index));
    return runAutoplayWithPreview(control, previewId, expected, (offered) => {
      // Measure after the preview so the ghost starts from the lifted position, like a manual play.
      const element = ctx.handCardRefs.current[getHandCardKey(card, index)];
      const sourceRect = element ? getCardRect(element.getBoundingClientRect()) : { x: 0, y: 0, width: 0, height: 0 };
      return handlePlayCard(card, index, sourceRect, offered, { silentReject: true });
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

  async function handleAutoplayWish(
    card: BattleCard,
    control: AutoplayCardControl,
    expected: BattleSnapshot,
  ): Promise<boolean> {
    return runAutoplayWithPreview(control, getHoverId("wish", card.id), expected, (offered) =>
      commitWishChoice(card, "autoplay wish choice", offered),
    );
  }

  function handleWishChoice(card: BattleCard, expected: BattleSnapshot) {
    if (getBattle().battleState !== expected) return;
    clearStaleAutoplayPreview();
    commitWishChoice(card, "wish choice", expected);
  }

  return { handleCardClick, handleWishChoice, handleAutoplayCard, handleAutoplayWish };
}
