/**
 * Enemy stun threshold resolution and stun-triggered talent/gear/boon effects.
 * Depends on: ./status-cc, ./talent-effects, ./trinket-effects, ./types, ./combat-text.
 */
import type { BattleState, CombatTextEvent } from "./types";
import { applyLuckyCloverGold } from "./trinket-effects";
import { applyGearCcPhysicalDamage, dealEnemyScaledDamage } from "./gear-effects";
import { getEnemyDamageMultiplier } from "./status-helpers";
import { applyCrowdControlTriggerBonuses } from "./talent-effects";
import { tryTriggerEnemyCc } from "./status-cc";
import { BATTLE_CONFIG, STUN_THRESHOLD_FRACTION } from "../game-constants";

function applyStunTriggerBonuses(state: BattleState, combatTexts?: CombatTextEvent[]): BattleState {
  const talents = state.talentEffects;
  const gear = state.gearEffects;
  return applyCrowdControlTriggerBonuses(
    state,
    {
      draw: talents.drawOnStun,
      nextCardFree: talents.nextCardFreeOnStun,
      block: talents.blockOnStun + gear.blockOnStun,
      forge: talents.forgeOnStun + gear.forgeOnStun,
      stripArmor: talents.stunStripArmor,
      mana: talents.manaOnStun + gear.manaOnStun,
    },
    combatTexts,
  );
}

function applyStunGearDamage(state: BattleState, combatTexts?: CombatTextEvent[]): BattleState {
  return applyGearCcPhysicalDamage(state, state.gearEffects.damageOnStunPhysical, combatTexts ?? [], {
    grantLuckyClover: true,
  });
}

function applyStunTrinketEffects(state: BattleState, combatTexts?: CombatTextEvent[]): BattleState {
  let nextState = state;
  if (nextState.trinketEffects.thunderstoneDamageOnStun > 0) {
    nextState = dealEnemyScaledDamage(
      nextState,
      nextState.trinketEffects.thunderstoneDamageOnStun,
      "nature",
      combatTexts ?? [],
      {
        multiplier: getEnemyDamageMultiplier(nextState, "nature"),
        riders: (damagedState, finalDamage) => applyLuckyCloverGold(damagedState, finalDamage, combatTexts ?? []),
      },
    );
  }
  return nextState;
}

/** Enemy stun threshold — runs immediately when stun stacks are added from damage. */
export function resolveStunTrigger(
  state: BattleState,
  combatTexts?: CombatTextEvent[],
  preHitHealth = state.enemyHealth,
) {
  const threshold = STUN_THRESHOLD_FRACTION - state.talentEffects.stunThresholdReduction;
  const triggered = tryTriggerEnemyCc({
    preHitHealth,
    nextState: state,
    stat: "stun",
    stackValue: state.enemyStatuses.stun,
    thresholdFraction: threshold,
    ccCooldown: state.enemyCC.cooldown,
    skipDuration: BATTLE_CONFIG.BASE_CC_DURATION + state.talentEffects.stunDurationExtension,
    combatTexts: combatTexts ?? [],
  });
  if (!triggered) return state;
  // CC immunity clears the stack without a stun — no stun rewards for a stun that didn't land.
  if (triggered.kind === "immune") return triggered.state;

  let nextState = triggered.state;
  nextState = applyStunTriggerBonuses(nextState, combatTexts);
  nextState = applyStunGearDamage(nextState, combatTexts);
  nextState = applyStunTrinketEffects(nextState, combatTexts);
  return nextState;
}
