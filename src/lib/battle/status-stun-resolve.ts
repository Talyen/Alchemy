import { clampHealth, setFlag, type BattleState, type CombatTextEvent } from "./types";
import { hasEnemyTrait } from "./enemy-trait-query";
import { addGoldWithCombatText, mergeCombatText } from "./combat-text";
import { applyLuckyCloverGold } from "./trinket-effects";
import { applyGearCcPhysicalDamage, dealEnemyScaledDamage } from "./gear-effects";
import { payKillPayouts } from "./kill-payouts";
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
    const enemyWasAlive = nextState.enemyHealth > 0;
    nextState = dealEnemyScaledDamage(
      nextState,
      nextState.trinketEffects.thunderstoneDamageOnStun,
      "nature",
      combatTexts ?? [],
      {
        multiplier: getEnemyDamageMultiplier(nextState, "nature"),
        riders: (damagedState, finalDamage) =>
          payKillPayouts(
            applyLuckyCloverGold(damagedState, finalDamage, combatTexts ?? []),
            enemyWasAlive,
            combatTexts ?? [],
          ),
      },
    );
  }
  return nextState;
}

function applyStunUniqueGearEffects(
  state: BattleState,
  combatTexts: CombatTextEvent[] | undefined,
  fromHolyBuildup: boolean,
  preTriggerMitigation?: BattleState["enemyMitigation"],
): BattleState {
  let nextState = state;
  if (nextState.gearEffects.stunPurgeDealHolyPerEffect > 0) {
    const mitigation = preTriggerMitigation ?? nextState.enemyMitigation;
    const purged = mitigation.armor + mitigation.block + mitigation.forge;
    if (purged > 0) {
      nextState = {
        ...nextState,
        enemyMitigation: { ...nextState.enemyMitigation, armor: 0, block: 0, forge: 0 },
      };
      const holyDamage = Math.round(
        purged * nextState.gearEffects.stunPurgeDealHolyPerEffect * getEnemyDamageMultiplier(nextState, "holy"),
      );
      if (holyDamage > 0) {
        mergeCombatText(combatTexts ?? [], { target: "enemy", kind: "damage", stat: "holy", amount: holyDamage });
        const enemyWasAlive = nextState.enemyHealth > 0;
        nextState = {
          ...nextState,
          enemyHealth: clampHealth(nextState.enemyHealth, -holyDamage, nextState.enemyMaxHealth),
        };
        nextState = payKillPayouts(nextState, enemyWasAlive, combatTexts ?? []);
      }
    }
  }
  if (fromHolyBuildup && nextState.gearEffects.holyStunBuildupGold > 0) {
    nextState = addGoldWithCombatText(nextState, nextState.gearEffects.holyStunBuildupGold, combatTexts ?? []);
  }
  return nextState;
}

export function resolveStunTrigger(
  state: BattleState,
  combatTexts?: CombatTextEvent[],
  preHitHealth = state.enemyHealth,
  fromHolyBuildup = false,
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

  if (triggered.kind === "immune") return triggered.state;

  let nextState = triggered.state;
  if (hasEnemyTrait(nextState, "brawler")) {
    nextState = setFlag(nextState, "enemyBrawlerDamagePenalty", true);
  }
  const preTriggerMitigation = nextState.enemyMitigation;
  nextState = applyStunTriggerBonuses(nextState, combatTexts);
  nextState = applyStunGearDamage(nextState, combatTexts);
  nextState = applyStunTrinketEffects(nextState, combatTexts);
  nextState = applyStunUniqueGearEffects(nextState, combatTexts, fromHolyBuildup, preTriggerMitigation);
  return nextState;
}
