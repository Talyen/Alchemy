import { useUiStore, isBattleInspectionOpen } from "../../shared/stores/ui-store";
import type { MouseEvent } from "react";
import {
  canPlayCard as canPlayCardInBattle,
  isAttackCard,
  type BattleSnapshot,
  type CombatTextEvent,
} from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
import { playCardSound, playGoldGain, playUISound } from "@/lib/audio";
import { AUTOPLAY_PREVIEW_MS, CARD_ACTIVATION_ROTATION_DEGREES } from "@/lib/game-constants";
import { shouldReduceMotion } from "@/lib/animation/animation-prefs";
import { resolveGameDelay } from "@/lib/animation/game-timer";
import { animateCardActivation } from "./card-transfer-animations";
import { getCardRect, getHoverId } from "../../shared/utils";
import { presentCombatTexts, shouldPlayCardGoldGain } from "./controller-utils";
import { PLAYABLE_HAND_OPTIONS, getHandCardKey } from "./playable-hand";
import { runBattleDraw } from "./draw-sequence";
import { type createBattleSession } from "./battle-session";
import type { createBattleTransferDeps } from "./draw-sequence";
import type { AutoplayCardControl, BattleControllerContext } from "./battle-context";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import { commitCardPlay, commitBattleWish } from "@/features/alchemy/shared/stores/battle-commands";

export function createBattleCardPlay(
  ctx: BattleControllerContext,
  session: ReturnType<typeof createBattleSession>,
  transferDeps: ReturnType<typeof createBattleTransferDeps>,
) {
  let autoplayPreviewSequence = 0;
  const getBattle = () => readBattle();
  const getPresentation = () => ctx.getPresentation();

  function finishDrawSequence(sessionNum: number) {
    if (ctx.playback.pendingCardDraws > 0) return;
    session.runIfSessionActive(sessionNum, () => {
      ctx.playback.completeAction(sessionNum);
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
      deps: transferDeps.getDrawSequenceDeps(),
      errorContext: `handle ${errorContext} draw sequence`,
      onSettled: () => {
        finishDraw();
        finishDrawSequence(sessionNum);
      },
    });
  }

  function canPlayCard(card: BattleCard, index: number, state: BattleSnapshot) {
    const presentation = getPresentation();
    return (
      !isBattleInspectionOpen(useUiStore.getState()) &&
      ctx.screen === "battle" &&
      ctx.playback.canAcceptInput(true) &&
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
    prePlayState: BattleSnapshot,
    postPlayState: BattleSnapshot,
    combatTexts: CombatTextEvent[],
  ) {
    if (shouldPlayCardGoldGain(prePlayState, postPlayState, card)) playGoldGain();
    presentCombatTexts(getPresentation(), combatTexts);
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
    commit: () => boolean | Promise<boolean>,
  ): Promise<boolean> {
    const sessionNum = ctx.playback.id;
    if (control.signal.aborted || !control.canCommit()) return false;
    const clearPreview = await previewAutoplayChoice(control, previewId);
    try {
      if (sessionNum !== ctx.playback.id || control.signal.aborted || !control.canCommit()) return false;
      return await commit();
    } finally {
      clearPreview();
    }
  }

  function handlePlayCard(
    card: BattleCard,
    index: number,
    sourceRect: { x: number; y: number; width: number; height: number },
    options?: { silentReject?: boolean },
  ): boolean {
    clearStaleAutoplayPreview();
    getPresentation().setDisplayedBattle(null);
    const currentState = getBattle().battleState;
    if (card.uid !== undefined) {
      index = currentState.hand.findIndex((candidate) => candidate.uid === card.uid && candidate.id === card.id);
    }
    if (!canPlayCard(card, index, currentState)) {
      if (!options?.silentReject) playUISound("error");
      return false;
    }
    const sessionNum = ctx.playback.id;
    const played = commitCardPlay(index, card.id);
    if (!played) {
      if (!options?.silentReject) playUISound("error");
      return false;
    }
    session.checkBattleEnd(played.state, sessionNum);
    ctx.playback.beginAction();
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
      },
      sessionNum,
      "play card",
    );
    return true;
  }

  function handleCardClick(card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) {
    handlePlayCard(card, index, getCardRect(event.currentTarget.getBoundingClientRect()));
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
      const ui = useUiStore.getState();
      ui.setAutoplayPreviewCardId(previewId);
      ui.maybeTriggerShimmer(previewId);
      await new Promise<void>((resolve) => {
        const finish = () => {
          clearTimeout(timer);
          control.signal.removeEventListener("abort", finish);
          if (control.signal.aborted) clearPreview();
          resolve();
        };
        const timer = setTimeout(finish, resolveGameDelay(AUTOPLAY_PREVIEW_MS));
        control.signal.addEventListener("abort", finish, { once: true });
      });
    }
    return clearPreview;
  }

  async function handleAutoplayCard(card: BattleCard, index: number, control: AutoplayCardControl): Promise<boolean> {
    const previewId = getHoverId("hand", getHandCardKey(card, index));
    return runAutoplayWithPreview(control, previewId, () => {
      // Measure after the preview so the ghost starts from the lifted position, like a manual play.
      const element = ctx.handCardRefs.current[getHandCardKey(card, index)];
      const sourceRect = element ? getCardRect(element.getBoundingClientRect()) : { x: 0, y: 0, width: 0, height: 0 };
      return handlePlayCard(card, index, sourceRect, { silentReject: true });
    });
  }

  function commitWishChoice(card: BattleCard, errorContext: string): boolean {
    const currentState = getBattle().battleState;
    if (!currentState.wishOptions?.some((option) => option.id === card.id)) return false;
    const newState = commitBattleWish(card.id);
    if (!newState) return false;
    const sessionNum = ctx.playback.id;
    session.checkBattleEnd(newState, sessionNum);
    runDrawSequenceAndFinalize(currentState.hand, newState, () => {}, sessionNum, errorContext);
    return true;
  }

  async function handleAutoplayWish(card: BattleCard, control: AutoplayCardControl): Promise<boolean> {
    return runAutoplayWithPreview(control, getHoverId("wish", card.id), () =>
      commitWishChoice(card, "autoplay wish choice"),
    );
  }

  function handleWishChoice(card: BattleCard) {
    clearStaleAutoplayPreview();
    commitWishChoice(card, "wish choice");
  }

  return { handleCardClick, handleWishChoice, handleAutoplayCard, handleAutoplayWish };
}
