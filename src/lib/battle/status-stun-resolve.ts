/**
 * Enemy stun threshold resolution and stun-triggered talent/boon effects.
 * Depends on: ./status-forge, ./status-cc, ./talent-effects, ./boon-effects, ./types, ./combat-text.
 */
import { clampHealth, type BattleState, type CombatTextEvent } from "./types";
import { mergeCombatText } from "./combat-text";
import { applyLuckyCloverGold } from "./boon-effects";
import { getEnemyDamageMultiplier } from "./status-effects";
import {
  applyStunBlockTalent,
  applyStunDrawTalent,
  applyStunFreeCardTalent,
  applyStunManaTalent,
  applyStunStripArmorTalent,
} from "./talent-effects";
import { applyEnemyCcImmunityClear, assignEnemyCrowdControlSkip } from "./status-cc";
import { applyStunForgeTalent } from "./status-forge";
import { BATTLE_CONFIG, STUN_THRESHOLD_FRACTION } from "../game-constants";

function applyStunTalentEffects(state: BattleState, combatTexts?: CombatTextEvent[]): BattleState {
  let nextState = state;
  nextState = applyStunDrawTalent(nextState);
  nextState = applyStunFreeCardTalent(nextState);
  nextState = applyStunBlockTalent(nextState, combatTexts);
  nextState = applyStunForgeTalent(nextState, combatTexts);
  nextState = applyStunStripArmorTalent(nextState);
  nextState = applyStunManaTalent(nextState, combatTexts);
  return nextState;
}

function applyStunBoonEffects(state: BattleState, combatTexts?: CombatTextEvent[]): BattleState {
  let nextState = state;
  if (nextState.boonEffects.thunderstoneDamageOnStun > 0) {
    const dmg = nextState.boonEffects.thunderstoneDamageOnStun;
    const multiplier = getEnemyDamageMultiplier(nextState, "nature");
    const finalDamage = Math.round(dmg * multiplier);
    nextState = {
      ...nextState,
      enemyHealth: clampHealth(nextState.enemyHealth, -finalDamage, nextState.enemyMaxHealth),
    };
    if (combatTexts) {
      mergeCombatText(combatTexts, {
        target: "enemy",
        kind: "damage",
        stat: "nature",
        amount: finalDamage,
      });
    }
    nextState = applyLuckyCloverGold(nextState, finalDamage, combatTexts ?? []);
  }
  return nextState;
}

/** Enemy stun threshold — runs immediately when stun stacks are added from damage. */
export function resolveStunTrigger(state: BattleState, combatTexts?: CombatTextEvent[]) {
  const threshold = STUN_THRESHOLD_FRACTION - state.talentEffects.stunThresholdReduction;
  if (state.enemyHealth <= 0 || state.enemyStatuses.stun < state.enemyHealth * threshold) return state;

  const immuneClear = applyEnemyCcImmunityClear({
    nextState: state,
    stat: "stun",
    ccCooldown: state.enemyCCCooldown,
  });
  if (immuneClear) return immuneClear;

  let nextState = assignEnemyCrowdControlSkip({
    nextState: state,
    stat: "stun",
    skipDuration: BATTLE_CONFIG.BASE_CC_DURATION + state.talentEffects.stunDurationExtension,
    combatTexts: combatTexts ?? [],
  });

  nextState = applyStunTalentEffects(nextState, combatTexts);
  nextState = applyStunBoonEffects(nextState, combatTexts);
  return nextState;
}
