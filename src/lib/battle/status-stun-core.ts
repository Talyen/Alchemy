import { recordEnemyAbilityActivation } from "./battle-metrics";
import { hasEnemyTrait, setFlag, setEnemyStatus, type BattleState, type CombatTextEvent } from "./types";
import { addGoldWithCombatText, applyHitEpilogue } from "./player-rewards";
import { applyLuckyCloverGold, applyNatureGoldReward, applyNatureManaRefund } from "./bonus-effects";
import { applyGearCcPhysicalDamage, dealEnemyScaledDamage } from "./scaled-damage";
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
          return applyHitEpilogue(
            applyNatureGoldReward(
              applyLuckyCloverGold(applyNatureManaRefund(leeched, finalDamage, texts), finalDamage, texts),
              healthDamage,
              texts,
            ),
            previousHealth,
            enemyWasAlive,
            texts,
          );
        },
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

export function resolveStunTriggerCore(
  state: BattleState,
  combatTexts: CombatTextEvent[] | undefined,
  preHitHealth: number,
  fromHolyDamage: boolean,
  leech: ThunderstoneLeech,
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
  nextState = applyStunTrinketEffects(nextState, leech, combatTexts);
  nextState = applyStunUniqueGearEffects(nextState, combatTexts, fromHolyDamage);
  return nextState;
}
