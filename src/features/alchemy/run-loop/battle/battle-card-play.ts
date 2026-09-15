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
import { applyCombatTextShakeFeedback, shouldPlayCardGoldGain } from "./battle-status";
import { playCombatTextSounds } from "./controller-utils";
import { PLAYABLE_HAND_OPTIONS, getHandCardKey } from "./playable-hand";
import { runBattleDraw, getPendingDrawCount, incrementPendingDraw, decrementPendingDraw } from "./draw-sequence";
import { type createBattleSession } from "./battle-session";
import type { createBattleTransferDeps } from "./battle-transfer-deps";
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
  const getBattle = () => readBattle();
  const getPresentation = () => ctx.getPresentation();

  function finishDrawSequence(sessionNum: number) {
    if (decrementPendingDraw(sessionNum) > 0) return;
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
    incrementPendingDraw(sessionNum);
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
      (!ctx.cardPlayInProgressRef.current || getPendingDrawCount(ctx.battleSessionRef.current) > 0) &&
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
    applyCombatTextShakeFeedback(combatTexts, getPresentation());
    playCombatTextSounds(combatTexts);
  }

  function handlePlayCard(
    card: BattleCard,
    index: number,
    sourceRect: { x: number; y: number; width: number; height: number },
    options?: { silentReject?: boolean },
  ): boolean {
    // A stale autoplay preview must never linger past the play it teased (manual takeover included).
    useUiStore.getState().setAutoplayPreviewCardId(null);
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

  async function handleAutoplayCard(card: BattleCard, index: number, control: AutoplayCardControl): Promise<boolean> {
    const sessionNum = ctx.battleSessionRef.current;
    if (control.signal.aborted || !control.canCommit()) return false;
    const sequence = ++autoplayPreviewSequence;
    const previewId = getHoverId("hand", getHandCardKey(card, index));
    const clearPreview = () => {
      const ui = useUiStore.getState();
      // An abandoned invocation must not clear a newer preview of the same card.
      if (sequence === autoplayPreviewSequence && ui.autoplayPreviewCardId === previewId) {
        ui.setAutoplayPreviewCardId(null);
      }
    };
    try {
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
      if (sessionNum !== ctx.battleSessionRef.current || control.signal.aborted || !control.canCommit()) return false;
      // Measure after the preview so the ghost starts from the lifted position, like a manual play.
      const element = ctx.handCardRefs.current[getHandCardKey(card, index)];
      const sourceRect = element ? getCardRect(element.getBoundingClientRect()) : { x: 0, y: 0, width: 0, height: 0 };
      return handlePlayCard(card, index, sourceRect, { silentReject: true });
    } finally {
      clearPreview();
    }
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
      return snapshotBattleState(next);
    });
    if (!newState) return;
    const sessionNum = ctx.battleSessionRef.current;
    session.checkBattleEnd(newState, sessionNum);
    runDrawSequenceAndFinalize(currentState.hand, newState, () => {}, sessionNum, "wish choice");
  }

  return { handleCardClick, handleWishChoice, handleAutoplayCard };
}
