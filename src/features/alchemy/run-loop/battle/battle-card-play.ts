import { useUiStore, isBattleInspectionOpen } from "../../shared/stores/ui-store";
import type { MouseEvent } from "react";
import {
  canPlayCard as canPlayCardInBattle,
  chooseWishCard,
  isAttackCard,
  playBattleCardResolved,
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
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  awardCardXP,
  setBattleState,
  withDraftWorldBattleRng,
  snapshotBattleState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import { discoverCardIds } from "../../shared/stores/profile-store";

export function createBattleCardPlay(
  ctx: BattleControllerContext,
  session: ReturnType<typeof createBattleSession>,
  transferDeps: ReturnType<typeof createBattleTransferDeps>,
) {
  let autoplayPreviewSequence = 0;
  // Card-play draws in flight, tracked here (not via the shared pending-draw
  // counter) so rapid plays stay allowed while their draw animations settle,
  // including when the draw pipeline itself is mocked in tests.
  let drawsInFlight = 0;
  const getBattle = () => readBattle();
  const getPresentation = () => ctx.getPresentation();

  function finishDrawSequence(sessionNum: number) {
    drawsInFlight = Math.max(0, drawsInFlight - 1);
    if (drawsInFlight > 0) return;
    session.runIfSessionActive(sessionNum, () => {
      ctx.cardPlayInProgressRef.current = false;
      const state = getBattle().battleState;
      ctx.scheduleAutoEndTurnRef.current?.(state);
    });
  }

  function runDrawSequenceAndFinalize(
    oldHand: BattleCard[],
    newState: BattleSnapshot,
    onReveal: () => void,
    sessionNum: number,
    errorContext: string,
  ) {
    drawsInFlight += 1;
    ctx.cardPlayInProgressRef.current = true;
    void runBattleDraw({
      oldHand,
      newState,
      onReveal: onReveal,
      session: sessionNum,
      deps: transferDeps.getDrawSequenceDeps(),
      errorContext: `handle ${errorContext} draw sequence`,
      onSettled: () => finishDrawSequence(sessionNum),
    });
  }

  function canPlayCard(card: BattleCard, index: number, state: BattleSnapshot) {
    const presentation = getPresentation();
    return (
      !isBattleInspectionOpen(useUiStore.getState()) &&
      ctx.screen === "battle" &&
      (!ctx.cardPlayInProgressRef.current || drawsInFlight > 0) &&
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
    const sessionNum = ctx.battleSessionRef.current;
    if (control.signal.aborted || !control.canCommit()) return false;
    const clearPreview = await previewAutoplayChoice(control, previewId);
    try {
      if (sessionNum !== ctx.battleSessionRef.current || control.signal.aborted || !control.canCommit()) return false;
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
    const sessionNum = ctx.battleSessionRef.current;
    const played = dispatchRunSessionCommand((draft) => {
      const bound = withDraftWorldBattleRng(draft, currentState);
      if (!canPlayCard(card, index, bound)) return null;
      const resolution = playBattleCardResolved(bound, card.id, index, PLAYABLE_HAND_OPTIONS);
      setBattleState(draft, resolution.state);
      awardCardXP(draft, card);
      return { ...resolution, state: snapshotBattleState(resolution.state) };
    });
    if (!played) {
      if (!options?.silentReject) playUISound("error");
      return false;
    }
    session.checkBattleEnd(played.state, sessionNum);
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
    const newState = dispatchRunSessionCommand((draft) => {
      const bound = withDraftWorldBattleRng(draft, currentState);
      if (!bound.wishOptions?.some((option) => option.id === card.id)) return null;
      const next = chooseWishCard(bound, card.id);
      setBattleState(draft, next);
      discoverCardIds(draft, [card.id]);
      return snapshotBattleState(next);
    });
    if (!newState) return false;
    const sessionNum = ctx.battleSessionRef.current;
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
