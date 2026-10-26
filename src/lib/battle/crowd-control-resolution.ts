import {
  BATTLE_CONFIG,
  FREE_CARD_SENTINEL,
  FREEZE_THRESHOLD_FRACTION,
  MIN_CC_THRESHOLD_FRACTION,
  STUN_THRESHOLD_FRACTION,
  UNIQUE_GEAR_COMBAT,
} from "../game-constants";
import { isPlayerDefeated } from "./battle-outcome";
import { halveRounded } from "./amount-helpers";
import { writeCombatFlag } from "./action-context";
import { recordEnemyAbilityActivation } from "./battle-metrics";
import { stripEnemyArmor, stripEnemyBlock } from "./enemy-mitigation-state";
import { mergeCombatText } from "./combat-text-events";
import { hasEnemyTrait } from "./encounter-trait-state";
import { tryTriggerEnemyCc } from "./status-cc";
import { setEnemyStatus } from "./status-state";
import type { BattleState, CombatTextEvent, BattleResourceReward } from "./types";

export interface CrowdControlTriggerBonuses {
  block?: number;
  forge?: number;
  mana?: number;
  draw?: number;
  nextCardFree?: boolean;
  stripArmor?: boolean;
  stripBlock?: boolean;
}

interface CrowdControlBonusPort {
  draw: BattleResourceReward;
  block: BattleResourceReward;
  forge: BattleResourceReward;
  mana: BattleResourceReward;
}

export function resolveCrowdControlBonuses(
  state: BattleState,
  bonuses: CrowdControlTriggerBonuses,
  combatTexts: CombatTextEvent[],
  port: CrowdControlBonusPort,
): BattleState {
  let nextState = state;
  const draw = bonuses.draw ?? 0;
  if (draw > 0) {
    nextState = port.draw(nextState, draw, combatTexts);
    if (isPlayerDefeated(nextState)) return nextState;
  }
  if (bonuses.nextCardFree) {
    nextState = writeCombatFlag(nextState, "nextCardCostReduction", FREE_CARD_SENTINEL);
  }
  const block = bonuses.block ?? 0;
  if (block > 0) {
    nextState = port.block(nextState, block, combatTexts);
  }
  const forge = bonuses.forge ?? 0;
  if (forge > 0) {
    nextState = port.forge(nextState, forge, combatTexts);
  }
  for (const [stat, enabled, strip] of [
    ["armor", bonuses.stripArmor, stripEnemyArmor],
    ["block", bonuses.stripBlock, stripEnemyBlock],
  ] as const) {
    if (!enabled) continue;
    if (nextState.enemyMitigation[stat] > 0) {
      mergeCombatText(combatTexts, {
        target: "enemy",
        kind: "damage",
        stat,
        amount: nextState.enemyMitigation[stat],
        impact: false,
      });
    }
    nextState = strip(nextState);
  }
  const mana = bonuses.mana ?? 0;
  if (mana > 0) {
    nextState = port.mana(nextState, mana, combatTexts);
  }
  return nextState;
}

export interface CrowdControlResolutionPort {
  chance: (chance: number, state: BattleState) => boolean;
  bonuses: (state: BattleState, bonuses: CrowdControlTriggerBonuses, texts: CombatTextEvent[]) => BattleState;
  physical: BattleResourceReward;
  thunderstone: (state: BattleState, texts: CombatTextEvent[]) => BattleState;
  gold: BattleResourceReward;
  mana: BattleResourceReward;
}

/** Both hosts share eligibility and reward order; inspection supplies only known outcomes. */
export function resolveEnemyStun(
  state: BattleState,
  texts: CombatTextEvent[],
  port: CrowdControlResolutionPort,
  preHitHealth = state.enemyHealth,
  fromHolyDamage = false,
  setupHealthDamage = 0,
): BattleState {
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
  const purge = port.chance(gear.purgeOnStunChance, next);
  next = port.bonuses(
    next,
    {
      draw: talents.drawOnStun,
      nextCardFree: talents.nextCardFreeOnStun,
      block: next.playerStatuses.block === 0 ? talents.blockOnStun + gear.blockOnStun : 0,
      forge:
        (port.chance(talents.forgeOnStunChance, next) ? talents.forgeOnStun : 0) +
        gear.forgeOnStunChances.reduce((total, chance) => total + Number(port.chance(chance, next)), 0),
      stripArmor: talents.stunStripArmor,
      mana: next.mana === 0 ? talents.manaOnStun + gear.manaOnStun : 0,
    },
    texts,
  );
  if (isPlayerDefeated(next)) return next;
  next = port.physical(next, next.gearEffects.damageOnStunPhysical, texts);
  next = port.thunderstone(next, texts);
  if (fromHolyDamage && next.gearEffects.holyStunBuildupGold > 0)
    next = port.gold(next, next.gearEffects.holyStunBuildupGold, texts);
  // Purge rewards can cause more hits; settle them after Stun's own rewards.
  return purge ? writeCombatFlag(next, "pendingDisruptingPurge", true) : next;
}

export function resolveEnemyFreeze(
  eligibility: BattleState,
  state: BattleState,
  texts: CombatTextEvent[],
  port: Pick<CrowdControlResolutionPort, "bonuses" | "physical" | "mana">,
  preHitHealth = eligibility.enemyHealth,
  setupHealthDamage = 0,
): BattleState {
  const triggered = tryTriggerEnemyCc({
    preHitHealth,
    nextState: state,
    stat: "freeze",
    setupHealthDamage,
    stackValue: state.enemyStatuses.freeze,
    thresholdFraction: Math.max(
      MIN_CC_THRESHOLD_FRACTION,
      FREEZE_THRESHOLD_FRACTION - eligibility.talentEffects.freezeThresholdReduction,
    ),
    ccCooldown: state.enemyCC.cooldown,
    skipDuration: BATTLE_CONFIG.BASE_CC_DURATION + state.trinketEffects.freezeDurationExtension,
    combatTexts: texts,
  });
  if (!triggered) return state;
  if (triggered.kind === "immune") return triggered.state;
  let next = eligibility.talentEffects.archeryCritOnCrowdControl
    ? writeCombatFlag(triggered.state, "hawkEyeReady", true)
    : triggered.state;
  next = port.physical(next, next.trinketEffects.frozenHeartDamage, texts);
  next = port.physical(next, eligibility.gearEffects.damageOnFreezePhysical, texts);
  next = port.bonuses(
    next,
    {
      block: next.talentEffects.blockOnFreeze,
      stripArmor: next.talentEffects.freezeStripArmor,
      stripBlock: next.talentEffects.freezeStripBlock,
    },
    texts,
  );
  return next.gearEffects.freezeGrantsBlockAndMana > 0 && eligibility.mana === 0
    ? port.mana(next, halveRounded(next.playerStatuses.block), texts)
    : next;
}
