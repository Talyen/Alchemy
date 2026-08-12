/**
 * Enemy stun threshold resolution and stun-triggered talent/boon effects.
 * Depends on: ./status-forge, ./status-cc, ./talent-effects, ./trinket-effects, ./types, ./combat-text.
 */
import { addPlayerStatus, type BattleState, type CombatTextEvent } from "./types";
import { mergeCombatText } from "./combat-text";
import { applyLuckyCloverGold } from "./trinket-effects";
import { applyGearCcPhysicalDamage, dealEnemyScaledDamage } from "./gear-effects";
import { getEnemyDamageMultiplier } from "./status-helpers";
import {
  applyStunBlockTalent,
  applyStunDrawTalent,
  applyStunFreeCardTalent,
  applyStunManaTalent,
  applyStunStripArmorTalent,
} from "./talent-effects";
import { tryTriggerEnemyCc } from "./status-cc";
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
  return applyGearCcPhysicalDamage(state, state.gearEffects.damageOnStunPhysical, combatTexts ?? [], {
    grantLuckyClover: true,
  });
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
export function resolveStunTrigger(state: BattleState, combatTexts?: CombatTextEvent[]) {
  const threshold = STUN_THRESHOLD_FRACTION - state.talentEffects.stunThresholdReduction;
  const triggered = tryTriggerEnemyCc({
    preHitHealth: state.enemyHealth,
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
  nextState = applyStunTalentEffects(nextState, combatTexts);
  nextState = applyStunGearEffects(nextState, combatTexts);
  nextState = applyStunTrinketEffects(nextState, combatTexts);
  return nextState;
}
