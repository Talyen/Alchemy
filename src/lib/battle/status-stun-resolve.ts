import { recordEnemyAbilityActivation } from "./battle-metrics";
import { hasEnemyTrait, setFlag, setEnemyStatus, type BattleState, type CombatTextEvent } from "./types";
import { addGoldWithCombatText, applyHitEpilogue } from "./combat-text";
import { applyLuckyCloverGold, applyNatureManaRefund } from "./bonus-effects";
import { applyGearCcPhysicalDamage } from "./gear-effects";
import { dealEnemyScaledDamage } from "./scaled-damage";
import { getEnemyDamageMultiplier } from "./status-helpers";
import { applyCrowdControlTriggerBonuses } from "./bonus-effects";
import { tryTriggerEnemyCc } from "./status-cc";
import {
  BATTLE_CONFIG,
  MIN_CC_THRESHOLD_FRACTION,
  STUN_THRESHOLD_FRACTION,
  UNIQUE_GEAR_COMBAT,
} from "../game-constants";

function applyStunTriggerBonuses(state: BattleState, combatTexts?: CombatTextEvent[]): BattleState {
  const talents = state.talentEffects;
  const gear = state.gearEffects;
  return applyCrowdControlTriggerBonuses(
    state,
    {
      draw: talents.drawOnStun,
      nextCardFree: talents.nextCardFreeOnStun,
      block: state.playerStatuses.block === 0 ? talents.blockOnStun + gear.blockOnStun : 0,
      forge: state.playerStatuses.forge === 0 ? talents.forgeOnStun + gear.forgeOnStun : 0,
      stripArmor: talents.stunStripArmor,
      mana: state.mana === 0 ? talents.manaOnStun + gear.manaOnStun : 0,
    },
    combatTexts,
  );
}

function applyStunGearDamage(state: BattleState, combatTexts?: CombatTextEvent[]): BattleState {
  return applyGearCcPhysicalDamage(state, state.gearEffects.damageOnStunPhysical, combatTexts ?? []);
}

function applyStunTrinketEffects(state: BattleState, combatTexts?: CombatTextEvent[]): BattleState {
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
        // Nature refunds resolve before the shared threshold/kill epilogue.
        // Order against the epilogue is cosmetic (independent resources), so
        // the extras run first and the canonical tail stays in one place.
        riders: (damagedState, finalDamage, texts) =>
          applyHitEpilogue(
            applyLuckyCloverGold(applyNatureManaRefund(damagedState, finalDamage, texts), finalDamage, texts),
            previousHealth,
            enemyWasAlive,
            texts,
          ),
      },
    );
  }
  return nextState;
}

function applyStunUniqueGearEffects(
  state: BattleState,
  combatTexts: CombatTextEvent[] | undefined,
  fromHolyDamage: boolean,
): BattleState {
  return fromHolyDamage && state.gearEffects.holyStunBuildupGold > 0
    ? addGoldWithCombatText(state, state.gearEffects.holyStunBuildupGold, combatTexts ?? [])
    : state;
}

export function resolveStunTrigger(
  state: BattleState,
  combatTexts?: CombatTextEvent[],
  preHitHealth = state.enemyHealth,
  fromHolyDamage = false,
) {
  const threshold = Math.max(
    MIN_CC_THRESHOLD_FRACTION,
    STUN_THRESHOLD_FRACTION - state.talentEffects.stunThresholdReduction,
  );
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

  if (triggered.kind === "immune") return triggered.state;

  let nextState = state.talentEffects.archeryCritOnCrowdControl
    ? setFlag(triggered.state, "hawkEyeReady", true)
    : triggered.state;
  if (state.gearEffects.retainStunBuildup > 0) {
    nextState = setEnemyStatus(
      nextState,
      "stun",
      Math.round(state.enemyStatuses.stun * UNIQUE_GEAR_COMBAT.retainedStunMultiplier),
    );
  }
  if (hasEnemyTrait(nextState, "brawler")) {
    nextState = setFlag(recordEnemyAbilityActivation(nextState, "brawler"), "enemyBrawlerDamagePenalty", true);
  }
  nextState = applyStunTriggerBonuses(nextState, combatTexts);
  nextState = applyStunGearDamage(nextState, combatTexts);
  nextState = applyStunTrinketEffects(nextState, combatTexts);
  nextState = applyStunUniqueGearEffects(nextState, combatTexts, fromHolyDamage);
  return nextState;
}
