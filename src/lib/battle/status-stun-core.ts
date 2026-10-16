import { rollBattleChance } from "./chance-roll";
import { resolveEnemyStun } from "./crowd-control-resolution";
import type { BattleState, CombatTextEvent } from "./types";
import { addGoldWithCombatText, gainManaWithCombatText, applyHitEpilogue } from "./player-rewards";
import {
  applyLuckyCloverGold,
  applyNatureGoldReward,
  applyNatureManaRefund,
  applyCrowdControlTriggerBonuses,
} from "./bonus-effects";
import { applyGearCcPhysicalDamage, dealEnemyScaledDamage } from "./scaled-damage";
import { getEnemyDamageMultiplier } from "./status-helpers";

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
