import { useUiStore, isBattleInspectionOpen } from "../../shared/stores/ui-store";
import { enemyAbilityDealsDamage, getEnemyAbilityCard } from "@/lib/game-data";
import { isPlayerDefeated, type BattleTurnFrame } from "@/lib/battle";
import { playBattleEvent, playCardSound, playEnemyAttack } from "@/lib/audio";
import { COMPANION_ATTACK_DELAY_MS, ENEMY_ATTACK_RECOVERY_DELAY_MS, ENEMY_PHASE_DELAY_MS } from "@/lib/game-constants";
import { delay } from "@/lib/animation/game-timer";
import { isAnimationDisabled } from "@/lib/animation/animation-prefs";
import type { createBattleSession } from "./battle-session";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import { markBattleStage } from "@/lib/performance/battle-stage-marks";
import { isBattlePlaybackBlocked } from "./autoplay-driver";
import { logBattleError, playCompanionSound, presentCombatTexts } from "./controller-utils";
import type { createBattleTransferDeps } from "./draw-sequence";
import type { BattleControllerContext } from "./battle-context";
import { commitEndTurn, resumePendingBattleTransition } from "./battle-session";
import { getPendingDrawCount, runHandDrawSequence, type HandDrawSequenceDeps } from "./draw-sequence";
import type { BattlePresentationPort } from "./battle-presentation-store";

export interface PlayTurnFramesOptions {
  onHandDrawn?: () => void;
  isCardPlayInProgress?: () => boolean;
}

/** Playback consumes resolved frames and has no gameplay write capability. */
export async function playTurnFrames(
  frames: BattleTurnFrame[],
  sessionNum: number,
  deps: HandDrawSequenceDeps,
  presentation: BattlePresentationPort,
  options?: PlayTurnFramesOptions,
): Promise<void> {
  for (const { before, turn, companion } of frames) {
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
      await delay(ENEMY_PHASE_DELAY_MS);
      if (!deps.isSessionActive(sessionNum)) return;
      if (turn.enemyPerformedAbility) {
        const ability = turn.state.lastEnemyAbilityId ? getEnemyAbilityCard(turn.state.lastEnemyAbilityId) : null;
        if (ability) playCardSound(ability.id);
        else playEnemyAttack(before.currentEnemy.id);
        if (!ability || enemyAbilityDealsDamage(ability)) presentation.telegraphAttack("enemy");
        else presentation.telegraphCast("enemy");
      }
      presentation.setDisplayedBattle({ ...(turn.afterAbilityState ?? turn.state), hand: [], turnPhase: "enemy" });
      if (!before.deathsDoorActive && turn.state.deathsDoorActive) playBattleEvent("deathsDoor");
      presentCombatTexts(presentation, turn.enemyResolutionCombatTexts);
      await delay(ENEMY_ATTACK_RECOVERY_DELAY_MS);
      if (!deps.isSessionActive(sessionNum)) return;
      markBattleStage("enemy-end");
    } else {
      presentCombatTexts(presentation, turn.combatTexts);
    }
    await runHandDrawSequence(
      before.hand,
      turn.state,
      () => presentation.setDisplayedBattle(turn.state),
      sessionNum,
      deps,
    );
    if (!deps.isSessionActive(sessionNum)) return;
    options?.onHandDrawn?.();
    if (companion) {
      await delay(COMPANION_ATTACK_DELAY_MS);
      if (!deps.isSessionActive(sessionNum)) return;
      if (!options?.isCardPlayInProgress?.()) {
        presentation.setDisplayedBattle(companion.state);
      }
      playCompanionSound(companion.id);
      presentation.shakeCompanion();
      presentation.telegraphAttack("companion");
      presentCombatTexts(presentation, companion.texts);
    }
  }
}

export function createBattleEndTurnUi(
  ctx: BattleControllerContext,
  session: ReturnType<typeof createBattleSession>,
  transferDeps: ReturnType<typeof createBattleTransferDeps>,
) {
  function handleEndTurn() {
    const battle = readBattle();
    const currentState = battle.battleState;
    const presentation = ctx.getPresentation();
    if (
      isBattlePlaybackBlocked({
        screen: ctx.screen,
        battleState: currentState,
        hasActiveBattle: battle.hasActiveBattle,
        cardTransferInProgress: presentation.cardTransferInProgress,
        hiddenHandCardKeys: presentation.hiddenHandCardKeys,
        cardPlayInProgress: ctx.cardPlayInProgressRef.current,
        inspectionOpen: isBattleInspectionOpen(useUiStore.getState()),
      })
    )
      return;

    // Commit before starting any animation. Failed resolution leaves both gameplay and presentation untouched.
    const result = commitEndTurn();
    ctx.clearAutoEndTurnRef.current?.();
    ctx.cardPlayInProgressRef.current = true;
    session.clearAllBattleTimeouts();
    const sessionNum = ctx.battleSessionRef.current;
    if (result.state.enemyHealth <= 0 || isPlayerDefeated(result.state)) {
      for (const { turn, companion } of result.frames) {
        if (turn.kind === "haste") presentCombatTexts(presentation, turn.combatTexts);
        else {
          presentCombatTexts(presentation, turn.enemyTurnStartCombatTexts);
          presentCombatTexts(presentation, turn.enemyResolutionCombatTexts);
        }
        if (companion) presentCombatTexts(presentation, companion.texts);
      }
      presentation.setDisplayedBattle(null);
      presentation.resetHandTransferUi();
      ctx.cardPlayInProgressRef.current = false;
      session.checkBattleEnd(result.state, sessionNum);
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
            ...transferDeps.getDrawSequenceDeps(),
            // Stronger than the base session guard on purpose: abandoning the
            // battle screen mid-playback (e.g. menu navigation) must freeze
            // playback even while the session itself is still current.
            isSessionActive: (id) => ctx.screen === "battle" && session.isCurrentBattleSession(id),
          },
          presentation,
          {
            onHandDrawn: () => {
              session.runIfSessionActive(sessionNum, () => {
                ctx.cardPlayInProgressRef.current = false;
              });
            },
            isCardPlayInProgress: () => ctx.cardPlayInProgressRef.current,
          },
        );
      } catch (error) {
        logBattleError("play resolved turn", error);
      } finally {
        session.runIfSessionActive(sessionNum, () => {
          presentation.setDisplayedBattle(null);
          presentation.resetHandTransferUi();
          if (getPendingDrawCount(sessionNum) === 0) {
            ctx.cardPlayInProgressRef.current = false;
            ctx.scheduleAutoEndTurnRef.current?.(readBattle().battleState);
          }
        });
      }
    })();
  }

  function resumePendingBattleTransitionUi() {
    const state = resumePendingBattleTransition(ctx.battleSessionRef.current, session);
    if (state) ctx.scheduleAutoEndTurnRef.current?.(state);
  }

  return { handleEndTurn, resumePendingBattleTransition: resumePendingBattleTransitionUi };
}
