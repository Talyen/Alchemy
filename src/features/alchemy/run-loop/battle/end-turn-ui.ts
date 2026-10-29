import { useUiStore, isBattleInspectionOpen } from "../../shared/stores/react/ui-store";
import { enemyAbilityDealsDamage, getEnemyAbilityCard } from "@/lib/game-data";
import { getBattleOutcome, type BattleSnapshot, type BattleTurnFrame } from "@/lib/battle";
import { playBattleEvent } from "@/lib/audio";
import { COMPANION_ATTACK_DELAY_MS, ENEMY_ATTACK_RECOVERY_DELAY_MS, ENEMY_PHASE_DELAY_MS } from "@/lib/game-constants";
import { isAnimationDisabled } from "@/lib/animation/animation-prefs";
import type { createBattleSession } from "./battle-session";
import { markBattleStage } from "@/lib/performance/marks";
import { isBattlePlaybackBlocked } from "./playback-gate";
import { logBattleError, playResolvedCombatSound, presentCombatTexts } from "./controller-utils";
import type { createBattleTransferDeps } from "./battle-transfers";
import type { BattleControllerContext } from "./battle-context";
import { commitEndTurn } from "./battle-session";
import { runHandDrawSequence, type HandDrawSequenceDeps } from "./draw-sequence";
import type { BattlePresentationPort } from "./battle-presentation-store";
import { presentCompanionAction } from "./companion-presentation";

export interface PlayTurnFramesOptions {
  onHandDrawn?: () => void;
  isCardPlayInProgress?: () => boolean;
}

function presentTurnResolution(frame: BattleTurnFrame, presentation: BattlePresentationPort) {
  const { before, turn } = frame;
  presentation.enqueueCompanionActions(frame.companionActions ?? []);
  const texts = turn.kind === "haste" ? turn.combatTexts : turn.enemyResolutionCombatTexts;
  const sound = playResolvedCombatSound(
    turn.kind === "haste"
      ? "haste"
      : turn.enemyPerformedAbility
        ? (turn.state.lastEnemyAbilityId ?? undefined)
        : undefined,
    texts,
    !before.deathsDoorActive && turn.state.deathsDoorActive,
  );
  presentCombatTexts(presentation, texts, sound);
}

function presentCompanionResolution(frame: BattleTurnFrame, presentation: BattlePresentationPort, animate = false) {
  const { turn, companion } = frame;
  if (!companion) return;
  const sound = playResolvedCombatSound(
    undefined,
    companion.texts,
    !turn.state.deathsDoorActive && companion.state.deathsDoorActive,
  );
  if (animate) {
    if (companion.actions) presentation.enqueueCompanionActions(companion.actions);
    else presentCompanionAction(presentation, turn.state.activeCompanion);
  }
  presentCombatTexts(presentation, companion.texts, sound);
}

/** Playback consumes resolved frames and has no gameplay write capability. */
export async function playTurnFrames(
  frames: BattleTurnFrame[],
  sessionNum: number,
  deps: HandDrawSequenceDeps,
  presentation: BattlePresentationPort,
  options?: PlayTurnFramesOptions,
): Promise<void> {
  for (const frame of frames) {
    const { before, turn, companion } = frame;
    if (!deps.isSessionActive(sessionNum)) return;
    if (turn.kind !== "haste") {
      markBattleStage("enemy-start");
      presentation.setDisplayedBattle({
        ...turn.enemyTurnStartState,
        hand: [],
        playerHealth: before.playerHealth,
        playerStatuses: before.playerStatuses,
        turnPhase: "enemy",
      });
      presentCombatTexts(presentation, turn.enemyTurnStartCombatTexts);
      if (!(await deps.playback.waitForDelay(sessionNum, ENEMY_PHASE_DELAY_MS))) return;
      if (!deps.isSessionActive(sessionNum)) return;
      if (turn.enemyPerformedAbility) {
        const ability = turn.state.lastEnemyAbilityId ? getEnemyAbilityCard(turn.state.lastEnemyAbilityId) : null;
        if (!ability || enemyAbilityDealsDamage(ability)) presentation.telegraphAttack("enemy");
        else presentation.telegraphCast("enemy");
      }
      presentation.setDisplayedBattle({ ...(turn.afterAbilityState ?? turn.state), hand: [], turnPhase: "enemy" });
      presentTurnResolution(frame, presentation);
      await presentation.waitForCompanionActions();
      if (!(await deps.playback.waitForDelay(sessionNum, ENEMY_ATTACK_RECOVERY_DELAY_MS))) return;
      if (!deps.isSessionActive(sessionNum)) return;
      markBattleStage("enemy-end");
    } else {
      presentTurnResolution(frame, presentation);
      await presentation.waitForCompanionActions();
    }
    await runHandDrawSequence(
      before.hand,
      turn.state,
      () => presentation.setDisplayedBattle(turn.state),
      sessionNum,
      deps,
      frame.drawnCardUids,
    );
    if (!deps.isSessionActive(sessionNum)) return;
    if (!turn.playerTurnSkipped && !companion) options?.onHandDrawn?.();
    if (companion) {
      if (!(await deps.playback.waitForDelay(sessionNum, COMPANION_ATTACK_DELAY_MS))) return;
      if (!deps.isSessionActive(sessionNum)) return;
      if (options?.isCardPlayInProgress?.()) presentCompanionResolution(frame, presentation, true);
      else
        await runHandDrawSequence(
          turn.state.hand,
          companion.state,
          () => {
            presentation.setDisplayedBattle(companion.state);
            presentCompanionResolution(frame, presentation, true);
          },
          sessionNum,
          deps,
          companion.drawnCardUids,
        );
      await presentation.waitForCompanionActions();
      if (!deps.isSessionActive(sessionNum)) return;
      if (!turn.playerTurnSkipped) options?.onHandDrawn?.();
    }
  }
}

export function createBattleEndTurnUi(
  ctx: BattleControllerContext,
  session: ReturnType<typeof createBattleSession>,
  transferDeps: ReturnType<typeof createBattleTransferDeps>,
) {
  function handleEndTurn(expected: BattleSnapshot) {
    const battle = ctx.battle.read();
    const currentState = battle.battleState;
    const presentation = ctx.getPresentation();
    if (
      expected !== currentState ||
      !ctx.playback.canEndTurn() ||
      !!presentation.companionActionCue ||
      isBattlePlaybackBlocked({
        screen: ctx.screen,
        battleState: currentState,
        hasActiveBattle: battle.hasActiveBattle,
        cardTransferInProgress: presentation.cardTransferInProgress,
        hiddenHandCardKeys: presentation.hiddenHandCardKeys,
        cardPlayInProgress: ctx.playback.cardPlayInProgress,
        inspectionOpen: isBattleInspectionOpen(useUiStore.getState()),
      })
    )
      return;

    // Commit before starting any animation. Failed resolution leaves both gameplay and presentation untouched.
    const sessionNum = ctx.playback.id;
    const result = commitEndTurn(ctx.battle, currentState);
    if (!result) return;
    playBattleEvent("endTurn");
    if (!ctx.playback.beginAction(sessionNum)) return;
    ctx.playback.clearTimers(sessionNum);
    if (getBattleOutcome(result.state) !== null) {
      for (const frame of result.frames) {
        if (frame.turn.kind !== "haste") {
          presentCombatTexts(presentation, frame.turn.enemyTurnStartCombatTexts);
        }
        presentTurnResolution(frame, presentation);
        presentCompanionResolution(frame, presentation, true);
      }
      presentation.setDisplayedBattle(null);
      presentation.resetHandTransferUi();
      void presentation.waitForCompanionActions().then(() => {
        session.runIfSessionActive(sessionNum, () => {
          ctx.playback.completeAction(sessionNum);
          session.checkBattleEnd(result.state, sessionNum);
        });
      });
      return;
    }
    presentation.setDisplayedBattle(currentState);
    void (async () => {
      try {
        markBattleStage("discard-start");
        try {
          if (!isAnimationDisabled()) await transferDeps.animateDiscardedHand(currentState.hand, sessionNum);
        } catch (error) {
          logBattleError("discard hand animation", error);
        }
        if (!session.isCurrentBattleSession(sessionNum)) return;
        markBattleStage("discard-end");
        await playTurnFrames(
          result.frames,
          sessionNum,
          {
            ...transferDeps.getDrawSequenceDeps(sessionNum),
            // Stronger than the base session guard on purpose: abandoning the
            // battle screen mid-playback (e.g. menu navigation) must freeze
            // playback even while the session itself is still current.
            isSessionActive: (id) => ctx.screen === "battle" && session.isCurrentBattleSession(id),
          },
          presentation,
          {
            onHandDrawn: () => {
              session.runIfSessionActive(sessionNum, () => {
                ctx.playback.completeAction(sessionNum);
              });
            },
            // The end-turn action itself owns the playing phase. Only a newer
            // card draw owns the hand and must prevent a stale frame reveal.
            isCardPlayInProgress: () => ctx.playback.pendingCardDraws > 0,
          },
        );
      } catch (error) {
        logBattleError("play resolved turn", error);
      } finally {
        session.runIfSessionActive(sessionNum, () => {
          presentation.setDisplayedBattle(null);
          if (ctx.playback.pendingDraws === 0) {
            presentation.resetHandTransferUi();
            ctx.playback.completeAction(sessionNum);
            ctx.playback.scheduleAutoEndTurn(ctx.battle.read().battleState);
          }
        });
      }
    })();
  }

  return { handleEndTurn };
}
