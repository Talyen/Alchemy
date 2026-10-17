import { resolveSecondaryAction } from "./action-context";
import { rollBattleChance } from "./chance-roll";
import { emitEnemyBuildupImmunity, mergeCombatText } from "./combat-text-events";
import { resolveEnemyStun } from "./crowd-control-resolution";
import { computeCardDamageToEnemy } from "./damage-calc";
import { applyHitHealth } from "./player-hit-core";
import type { BattleState, CombatTextEvent } from "./types";
import { addGoldWithCombatText, gainManaWithCombatText, applyHitEpilogue } from "./player-rewards";
import {
  applyLuckyCloverGold,
  applyNatureGoldReward,
  applyNatureManaRefund,
  applyCrowdControlTriggerBonuses,
} from "./bonus-effects";
import { applyGearCcPhysicalDamage, dealEnemyScaledDamage } from "./scaled-damage";
import { decayArmorAfterDamage, getEnemyDamageMultiplier } from "./status-helpers";
import { addEnemyStatus } from "./status-state";

export type ThunderstoneLeech = (state: BattleState, damage: number, texts: CombatTextEvent[]) => BattleState;

function applyStunTrinketEffects(
  state: BattleState,
  leech: ThunderstoneLeech,
  combatTexts?: CombatTextEvent[],
): BattleState {
  let nextState = state;
  if (nextState.trinketEffects.thunderstoneDamageOnStun > 0) {
    const previousHealth = nextState.enemyHealth;
    const enemyWasAlive = previousHealth > 0;
    nextState = dealEnemyScaledDamage(
      nextState,
      nextState.trinketEffects.thunderstoneDamageOnStun,
      "nature",
      combatTexts ?? [],
      {
        multiplier: getEnemyDamageMultiplier(nextState, "nature"),
        // Capture the hit's Health loss before Leech can trigger more damage;
        // the shared threshold and kill epilogue still closes this packet.
        riders: (damagedState, finalDamage, texts) => {
          const healthDamage = Math.max(0, previousHealth - damagedState.enemyHealth);
          const leeched =
            state.gearEffects.natureLeechVsPoisoned > 0 && state.enemyStatuses.poison > 0
              ? leech(damagedState, healthDamage, texts)
              : damagedState;
          let rewarded = applyNatureManaRefund(leeched, finalDamage, texts);
          rewarded = applyLuckyCloverGold(rewarded, healthDamage, texts);
          rewarded = applyNatureGoldReward(rewarded, healthDamage, texts);
          return applyHitEpilogue(
            rewarded,
            previousHealth,
            enemyWasAlive,
            texts,
            undefined,
            state.playerStatuses.forge >= 5,
          );
        },
      },
    );
  }
  return nextState;
}

export function resolveStunTriggerCore(
  state: BattleState,
  combatTexts: CombatTextEvent[] | undefined,
  preHitHealth: number,
  fromHolyDamage: boolean,
  leech: ThunderstoneLeech,
  setupHealthDamage = 0,
) {
  return resolveEnemyStun(
    state,
    combatTexts ?? [],
    {
      chance: rollBattleChance,
      bonuses: applyCrowdControlTriggerBonuses,
      physical: applyGearCcPhysicalDamage,
      thunderstone: (current, texts) => applyStunTrinketEffects(current, leech, texts),
      gold: addGoldWithCombatText,
      mana: (current, amount, texts) => gainManaWithCombatText(current, amount, texts, { skipFightPacing: true }),
    },
    preHitHealth,
    fromHolyDamage,
    setupHealthDamage,
  );
}

/** Leaf stun entry: stays free of hit-resolution tiers so leech riders can call it without a module cycle. */
export function resolveStunFollowUpHit(
  state: BattleState,
  amount: number,
  combatTexts: CombatTextEvent[],
  leech: ThunderstoneLeech,
): BattleState {
  return resolveSecondaryAction(state, "reward", (current) => {
    if (amount <= 0 || current.enemyHealth <= 0) return current;
    const effect = { kind: "damage" as const, damageType: "stun" as const, amount };
    const { nextState: afterMods, modifiedDamage, critical } = computeCardDamageToEnemy(current, effect);
    const hit = applyHitHealth(afterMods, modifiedDamage, current, critical);
    const decayed = decayArmorAfterDamage(hit.state, modifiedDamage, "enemy", combatTexts);
    emitEnemyBuildupImmunity(decayed, "stun", modifiedDamage, combatTexts);
    let nextState = resolveStunTriggerCore(
      addEnemyStatus(decayed, "stun", modifiedDamage),
      combatTexts,
      hit.facts.previousHealth,
      false,
      leech,
      hit.facts.healthDamage,
    );
    if (modifiedDamage > 0) {
      mergeCombatText(combatTexts, {
        target: "enemy",
        kind: "damage",
        stat: "stun",
        amount: modifiedDamage,
        ...(hit.facts.healthDamage !== modifiedDamage ? { healthLost: hit.facts.healthDamage } : {}),
        ...(critical && hit.facts.healthDamage > 0 ? { critical: true } : {}),
      });
    }
    return applyHitEpilogue(
      nextState,
      hit.facts.previousHealth,
      hit.facts.enemyWasAlive,
      combatTexts,
      undefined,
      afterMods.playerStatuses.forge >= 5,
    );
  });
}
