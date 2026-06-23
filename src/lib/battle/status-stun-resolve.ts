/**
 * Enemy stun threshold resolution and stun-triggered talent/boon effects.
 * Depends on: ./status-forge, ./status-cc, ./talent-effects, ./trinket-effects, ./types, ./combat-text.
 */
import { clampHealth, addPlayerStatus, type BattleState, type CombatTextEvent } from "./types";
import { mergeCombatText } from "./combat-text";
import { applyLuckyCloverGold } from "./trinket-effects";
import { applyGearKillRewards, applyGearProcPhysicalDamage } from "./gear-effects";
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

function applyStunGearDamage(state: BattleState, combatTexts?: CombatTextEvent[]): BattleState {
  const gear = state.gearEffects;
  if (gear.damageOnStunPhysical <= 0) return state;
  const enemyWasAlive = state.enemyHealth > 0;
  const finalDamage = applyGearProcPhysicalDamage(state, gear.damageOnStunPhysical);
  let next = { ...state, enemyHealth: clampHealth(state.enemyHealth, -finalDamage, state.enemyMaxHealth) };
  if (combatTexts)
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "physical", amount: finalDamage });
  next = applyLuckyCloverGold(next, finalDamage, combatTexts ?? []);
  if (enemyWasAlive && next.enemyHealth <= 0) next = applyGearKillRewards(next, true, combatTexts ?? []);
  return next;
}

function applyStunGearEffects(state: BattleState, combatTexts?: CombatTextEvent[]): BattleState {
  let nextState = state;
  const gear = nextState.gearEffects;
  nextState = applyStunGearDamage(nextState, combatTexts);
  if (gear.forgeOnStun > 0) {
    nextState = addPlayerStatus(nextState, "forge", gear.forgeOnStun);
    if (combatTexts)
      mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "forge", amount: gear.forgeOnStun });
  }
  if (gear.blockOnStun > 0) {
    const blockGain = gear.blockOnStun + (gear.flatBlockGained > 0 ? gear.flatBlockGained : 0);
    nextState = addPlayerStatus(nextState, "block", gear.blockOnStun);
    if (combatTexts)
      mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "block", amount: blockGain });
  }
  if (gear.manaOnStun > 0) {
    nextState = { ...nextState, mana: nextState.mana + gear.manaOnStun };
    if (combatTexts)
      mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount: gear.manaOnStun });
  }
  return nextState;
}

function applyStunTrinketEffects(state: BattleState, combatTexts?: CombatTextEvent[]): BattleState {
  let nextState = state;
  if (nextState.trinketEffects.thunderstoneDamageOnStun > 0) {
    const dmg = nextState.trinketEffects.thunderstoneDamageOnStun;
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
    ccCooldown: state.enemyCC.cooldown,
  });
  if (immuneClear) return immuneClear;

  let nextState = assignEnemyCrowdControlSkip({
    nextState: state,
    stat: "stun",
    skipDuration: BATTLE_CONFIG.BASE_CC_DURATION + state.talentEffects.stunDurationExtension,
    combatTexts: combatTexts ?? [],
  });

  nextState = applyStunTalentEffects(nextState, combatTexts);
  nextState = applyStunGearEffects(nextState, combatTexts);
  nextState = applyStunTrinketEffects(nextState, combatTexts);
  return nextState;
}
