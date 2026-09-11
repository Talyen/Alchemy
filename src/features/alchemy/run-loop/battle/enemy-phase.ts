import { enemyAbilityDealsDamage, getEnemyAbilityCard } from "@/lib/game-data";
import type { BattleTurnFrame, CombatTextEvent } from "@/lib/battle";
import { playBattleEvent, playCardSound, playEnemyAttack } from "@/lib/audio";
import { COMPANION_ATTACK_DELAY, ENEMY_ATTACK_RECOVERY_DELAY, ENEMY_PHASE_DELAY } from "@/lib/game-constants";
import { delay } from "@/lib/animation/game-timer";
import { markBattleStage } from "@/lib/performance/battle-stage-marks";
import { applyCombatTextShakeFeedback } from "./battle-status";
import { playCombatTextSounds, playCompanionSound } from "./controller-utils";
import { runHandDrawSequence, type HandDrawSequenceDeps } from "./draw-sequence";
import type { BattlePresentationPort } from "./battle-presentation-store";

function showTexts(texts: CombatTextEvent[], presentation: BattlePresentationPort) {
  presentation.showCombatTexts(texts);
  applyCombatTextShakeFeedback(texts, presentation);
  playCombatTextSounds(texts);
}

/** Playback consumes resolved frames and has no gameplay write capability. */
export async function playTurnFrames(
  frames: BattleTurnFrame[],
  sessionNum: number,
  deps: HandDrawSequenceDeps,
  presentation: BattlePresentationPort,
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
      showTexts(turn.enemyTurnStartCombatTexts, presentation);
      await delay(ENEMY_PHASE_DELAY);
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
      showTexts(turn.enemyResolutionCombatTexts, presentation);
      await delay(ENEMY_ATTACK_RECOVERY_DELAY);
      if (!deps.isSessionActive(sessionNum)) return;
      markBattleStage("enemy-end");
    } else {
      showTexts(turn.combatTexts, presentation);
    }
    await runHandDrawSequence(
      before.hand,
      turn.state,
      () => presentation.setDisplayedBattle(turn.state),
      sessionNum,
      deps,
    );
    if (!deps.isSessionActive(sessionNum)) return;
    if (companion) {
      await delay(COMPANION_ATTACK_DELAY);
      if (!deps.isSessionActive(sessionNum)) return;
      presentation.setDisplayedBattle(companion.state);
      playCompanionSound(companion.id);
      presentation.shakeCompanion();
      presentation.telegraphAttack("companion");
      showTexts(companion.texts, presentation);
    }
  }
}
