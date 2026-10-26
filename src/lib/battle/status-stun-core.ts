import { resolveSecondaryAction } from "./action-context";
import { rollBattleChance } from "./chance-roll";
import { emitEnemyBuildupImmunity, mergeCombatText } from "./combat-text-events";
import {
  BATTLE_CONFIG,
  MIN_CC_THRESHOLD_FRACTION,
  STUN_THRESHOLD_FRACTION,
  UNIQUE_GEAR_COMBAT,
} from "../game-constants";
import { isPlayerDefeated } from "./battle-outcome";
import { writeCombatFlag } from "./action-context";
import { recordEnemyAbilityActivation } from "./battle-metrics";
import { hasEnemyTrait } from "./encounter-trait-state";
import { tryTriggerEnemyCc } from "./status-cc";
import { computeCardDamageToEnemy } from "./damage-calc";
import { applyHitHealth } from "./player-hit-core";
import type { BattleState, CombatTextEvent } from "./types";
import { addGoldWithCombatText, applyHitEpilogue } from "./player-rewards";
import {
  applyLuckyCloverGold,
  applyNatureGoldReward,
  applyNatureManaRefund,
  applyCrowdControlTriggerBonuses,
} from "./bonus-effects";
import { applyGearCcPhysicalDamage, dealEnemyScaledDamage } from "./scaled-damage";
import { decayArmorAfterDamage, getEnemyDamageMultiplier } from "./status-helpers";
import { addEnemyStatus, setEnemyStatus } from "./status-state";

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
  const texts = combatTexts ?? [];
  const triggered = tryTriggerEnemyCc({
    preHitHealth,
    nextState: state,
    stat: "stun",
    setupHealthDamage,
    stackValue: state.enemyStatuses.stun,
    thresholdFraction: Math.max(
      MIN_CC_THRESHOLD_FRACTION,
      STUN_THRESHOLD_FRACTION - state.talentEffects.stunThresholdReduction,
    ),
    ccCooldown: state.enemyCC.cooldown,
    skipDuration: BATTLE_CONFIG.BASE_CC_DURATION + state.talentEffects.stunDurationExtension,
    combatTexts: texts,
  });
  if (!triggered) return state;
  if (triggered.kind === "immune") return triggered.state;
  let next = state.talentEffects.archeryCritOnCrowdControl
    ? writeCombatFlag(triggered.state, "hawkEyeReady", true)
    : triggered.state;
  if (state.gearEffects.retainStunBuildup > 0)
    next = setEnemyStatus(
      next,
      "stun",
      Math.round(state.enemyStatuses.stun * UNIQUE_GEAR_COMBAT.retainedStunMultiplier),
    );
  if (hasEnemyTrait(next, "brawler"))
    next = writeCombatFlag(recordEnemyAbilityActivation(next, "brawler"), "enemyBrawlerDamagePenalty", true);
  const talents = next.talentEffects;
  const gear = next.gearEffects;
  const purge = rollBattleChance(gear.purgeOnStunChance, next);
  next = applyCrowdControlTriggerBonuses(
    next,
    {
      draw: talents.drawOnStun,
      nextCardFree: talents.nextCardFreeOnStun,
      block: next.playerStatuses.block === 0 ? talents.blockOnStun + gear.blockOnStun : 0,
      forge:
        (rollBattleChance(talents.forgeOnStunChance, next) ? talents.forgeOnStun : 0) +
        gear.forgeOnStunChances.reduce((total, chance) => total + Number(rollBattleChance(chance, next)), 0),
      stripArmor: talents.stunStripArmor,
      mana: next.mana === 0 ? talents.manaOnStun + gear.manaOnStun : 0,
    },
    texts,
  );
  if (isPlayerDefeated(next)) return next;
  next = applyGearCcPhysicalDamage(next, next.gearEffects.damageOnStunPhysical, texts);
  next = applyStunTrinketEffects(next, leech, texts);
  if (fromHolyDamage && next.gearEffects.holyStunBuildupGold > 0)
    next = addGoldWithCombatText(next, next.gearEffects.holyStunBuildupGold, texts);
  // Purge rewards can cause more hits; settle them after Stun's own rewards.
  return purge ? writeCombatFlag(next, "pendingDisruptingPurge", true) : next;
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
    const nextState = resolveStunTriggerCore(
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
