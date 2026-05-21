// Status effect application: damage-type riders, player status effects, stun resolution, harmful removal.
// Bleed stacks 2x on apply; leech heals when bleed ticks. Enemy CC procs on damage; player CC on tick.
import { drawCards } from "./draw";
import { harmfulPlayerStatusIds } from "@/lib/game-data";
import type { BattleCardEffect } from "@/lib/game-data/types";
import {
  addEnemyStatus,
  addGold,
  addPlayerStatus,
  adjustEnemyStatusDelta,
  applyPlayerHealing,
  clampHealth,
  isNullFieldActive,
  setEnemyStatus,
  setFlag,
  type BattleState,
  type CombatTextEvent,
} from "./types";
import { mergeCombatText } from "./combat-text";
import { applyLuckyCloverGold } from "./trinket-effects";
import { applyEnemyCcImmunityClear, assignEnemyCrowdControlSkip } from "./status-cc";
import { rollPercent } from "./status-helpers";
import {
  BLEED_STATUS_MULTIPLIER,
  ENEMY_TRAIT_IDS,
  FIRST_EFFECT_MULTIPLIER,
  FREE_CARD_SENTINEL,
  FREEZE_THRESHOLD_FRACTION,
  HALF_DIVISOR,
  STUN_THRESHOLD_FRACTION,
  STATUS_CONFIG,
  TRAIT_DAMAGE_RESISTANCE,
  TRAIT_DAMAGE_WEAKNESS,
  BATTLE_CONFIG,
} from "../game-constants";

const TRAIT_DAMAGE_RULES: { traitId: string; damageType: string; multiplier: number }[] = [
  { traitId: ENEMY_TRAIT_IDS.BRITTLE_BONES, damageType: "holy", multiplier: TRAIT_DAMAGE_WEAKNESS },
  { traitId: ENEMY_TRAIT_IDS.BRITTLE_BONES, damageType: "stun", multiplier: TRAIT_DAMAGE_WEAKNESS },
  { traitId: ENEMY_TRAIT_IDS.TRINKET_HOARDER, damageType: "burn", multiplier: TRAIT_DAMAGE_WEAKNESS },
  { traitId: ENEMY_TRAIT_IDS.HOLY_VULNERABILITY, damageType: "holy", multiplier: TRAIT_DAMAGE_WEAKNESS },
  { traitId: ENEMY_TRAIT_IDS.BURN_RESISTANCE, damageType: "burn", multiplier: TRAIT_DAMAGE_RESISTANCE },
  { traitId: ENEMY_TRAIT_IDS.LIVING_ARMOR, damageType: "bleed", multiplier: TRAIT_DAMAGE_RESISTANCE },
  { traitId: ENEMY_TRAIT_IDS.THICK_HIDE, damageType: "physical", multiplier: TRAIT_DAMAGE_RESISTANCE },
  { traitId: ENEMY_TRAIT_IDS.POISON_RESISTANCE, damageType: "poison", multiplier: TRAIT_DAMAGE_RESISTANCE },
  { traitId: ENEMY_TRAIT_IDS.GLACIAL_SHELL, damageType: "freeze", multiplier: TRAIT_DAMAGE_RESISTANCE },
  { traitId: ENEMY_TRAIT_IDS.GLACIAL_SHELL, damageType: "burn", multiplier: TRAIT_DAMAGE_WEAKNESS },
];

/** Trait weakness/resistance — first matching trait wins. */
export function getEnemyDamageMultiplier(
  state: Pick<BattleState, "currentEnemy" | "enemyStunSkipTurns" | "enemyFreezeSkipTurns" | "talentEffects">,
  damageType: string,
): number {
  const traitIds = state.currentEnemy.traits.map((t) => t.id);
  for (const rule of TRAIT_DAMAGE_RULES) {
    if (traitIds.includes(rule.traitId) && damageType === rule.damageType) return rule.multiplier;
  }
  if (state.enemyStunSkipTurns > 0 && state.talentEffects.stunDoubleDamage) return TRAIT_DAMAGE_WEAKNESS;
  if (state.enemyFreezeSkipTurns > 0 && state.talentEffects.freezeDoubleDamage) return TRAIT_DAMAGE_WEAKNESS;
  return 1;
}

function computeForgeBurnAmount(state: BattleState): number {
  if (isNullFieldActive(state)) {
    return Math.max(STATUS_CONFIG.MIN_STACK_AMOUNT, Math.round(state.talentEffects.forgeBurnDamage / HALF_DIVISOR));
  }
  return state.talentEffects.forgeBurnDamage;
}

/** Forge burst when crossing forgeBurnThreshold — any forge source can trigger this. */
function applyForgeBurnBurst(state: BattleState, oldForge: number, newForge: number, combatTexts?: CombatTextEvent[]) {
  if (
    state.talentEffects.forgeBurnThreshold <= 0 ||
    oldForge >= state.talentEffects.forgeBurnThreshold ||
    newForge < state.talentEffects.forgeBurnThreshold
  ) {
    return state;
  }
  const burnAmount = computeForgeBurnAmount(state);
  const nextState = addEnemyStatus(state, "burn", burnAmount);
  if (combatTexts) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "burn", amount: burnAmount });
  }
  return nextState;
}

function applyStunTalentEffects(state: BattleState, combatTexts?: CombatTextEvent[]): BattleState {
  let nextState = state;

  if (nextState.talentEffects.drawOnStun > 0) {
    const draw = drawCards(
      nextState.deck,
      nextState.discard,
      nextState.hand,
      nextState.talentEffects.drawOnStun,
      nextState.nextCardUid,
    );
    nextState = {
      ...nextState,
      deck: draw.deck,
      discard: draw.discard,
      hand: draw.hand,
      nextCardUid: draw.nextCardUid,
    };
  }

  if (nextState.talentEffects.nextCardFreeOnStun) {
    nextState = setFlag(nextState, "nextCardCostReduction", FREE_CARD_SENTINEL);
  }

  if (nextState.talentEffects.blockOnStun > 0) {
    nextState = addPlayerStatus(nextState, "block", nextState.talentEffects.blockOnStun);
    if (combatTexts) {
      mergeCombatText(combatTexts, {
        target: "player",
        kind: "status",
        stat: "block",
        amount: nextState.talentEffects.blockOnStun,
      });
    }
  }

  if (nextState.talentEffects.forgeOnStun > 0) {
    const oldForge = nextState.playerStatuses.forge;
    const forgeAmount = nextState.talentEffects.forgeOnStun;
    nextState = addPlayerStatus(nextState, "forge", forgeAmount);
    nextState = applyForgeBurnBurst(nextState, oldForge, oldForge + forgeAmount, combatTexts);
    if (combatTexts) {
      mergeCombatText(combatTexts, {
        target: "player",
        kind: "status",
        stat: "forge",
        amount: forgeAmount,
      });
    }
  }

  if (nextState.talentEffects.stunStripArmor && nextState.enemyMitigation.armor > 0) {
    nextState = { ...nextState, enemyMitigation: { ...nextState.enemyMitigation, armor: 0 } };
  }

  if (nextState.talentEffects.manaOnStun > 0) {
    nextState = { ...nextState, mana: nextState.mana + nextState.talentEffects.manaOnStun };
    if (combatTexts) {
      mergeCombatText(combatTexts, {
        target: "player",
        kind: "status",
        stat: "mana",
        amount: nextState.talentEffects.manaOnStun,
      });
    }
  }

  return nextState;
}

function applyStunTrinketEffects(state: BattleState, combatTexts?: CombatTextEvent[]): BattleState {
  let nextState = state;
  if (nextState.trinketEffects.thunderstoneDamageOnStun > 0) {
    const dmg = nextState.trinketEffects.thunderstoneDamageOnStun;
    nextState = {
      ...nextState,
      enemyHealth: clampHealth(nextState.enemyHealth, -dmg, nextState.enemyMaxHealth),
    };
    if (combatTexts) {
      mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "nature", amount: dmg });
    }
    nextState = applyLuckyCloverGold(nextState, dmg, combatTexts ?? []);
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
    ccCooldown: state.enemyCCCooldown,
  });
  if (immuneClear) return immuneClear;

  let nextState = assignEnemyCrowdControlSkip({
    nextState: state,
    stat: "stun",
    skipDuration: BATTLE_CONFIG.BASE_CC_DURATION + state.talentEffects.stunDurationExtension,
    combatTexts: combatTexts ?? [],
  });

  nextState = applyStunTalentEffects(nextState, combatTexts);
  nextState = applyStunTrinketEffects(nextState, combatTexts);
  return nextState;
}

function applyBurnStatusRider(state: BattleState, actualDamage: number): BattleState {
  let nextState = addEnemyStatus(state, "burn", actualDamage);
  if (nextState.talentEffects.burnRemovesEnemyArmor) {
    nextState = {
      ...nextState,
      enemyMitigation: {
        ...nextState.enemyMitigation,
        armor: Math.max(0, nextState.enemyMitigation.armor - actualDamage),
      },
    };
  }
  return nextState;
}

function applyPoisonStatusRider(state: BattleState, actualDamage: number, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = addEnemyStatus(state, "poison", actualDamage);
  if (
    actualDamage > 0 &&
    nextState.talentEffects.goldOnFirstPoison > 0 &&
    !nextState.flags.goldOnFirstPoisonThisCombat
  ) {
    nextState = setFlag(
      addGold(nextState, nextState.talentEffects.goldOnFirstPoison),
      "goldOnFirstPoisonThisCombat",
      true,
    );
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat: "gold",
      amount: nextState.talentEffects.goldOnFirstPoison,
    });
  }
  return nextState;
}

function stackBleed(state: BattleState, statusDamage: number): BattleState {
  const bleedAmount = statusDamage * BLEED_STATUS_MULTIPLIER;
  return setEnemyStatus(state, "bleed", state.enemyStatuses.bleed + bleedAmount);
}

function queueBleedLeech(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  bleedAmount: number,
): BattleState {
  if (bleedAmount <= 0) return state;
  const leechFromCard = effect.lifesteal;
  const leechFromTalent = rollPercent(state.talentEffects.bleedLeechChance);
  if (!leechFromCard && !leechFromTalent) return state;
  return { ...state, pendingBleedLeechHealing: state.pendingBleedLeechHealing + bleedAmount };
}

function procBleedPoison(state: BattleState, actualDamage: number, bleedAmount: number): BattleState {
  if (bleedAmount <= 0 || actualDamage <= 0 || !rollPercent(state.talentEffects.bleedPoisonChance)) return state;
  return addEnemyStatus(state, "poison", actualDamage);
}

function awardCutpurseGold(state: BattleState, bleedAmount: number, combatTexts: CombatTextEvent[]): BattleState {
  if (bleedAmount <= 0 || state.trinketEffects.cutpurseGoldOnBleed <= 0) return state;
  mergeCombatText(combatTexts, {
    target: "player",
    kind: "status",
    stat: "gold",
    amount: state.trinketEffects.cutpurseGoldOnBleed,
  });
  return addGold(state, state.trinketEffects.cutpurseGoldOnBleed);
}

function applyBleedStatusRider(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  actualDamage: number,
  statusDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  const bleedAmount = statusDamage * BLEED_STATUS_MULTIPLIER;
  let nextState = stackBleed(state, statusDamage);
  nextState = queueBleedLeech(nextState, effect, bleedAmount);
  nextState = procBleedPoison(nextState, actualDamage, bleedAmount);
  return awardCutpurseGold(nextState, bleedAmount, combatTexts);
}

function applyStunStatusRider(state: BattleState, actualDamage: number, combatTexts: CombatTextEvent[]): BattleState {
  return resolveStunTrigger(addEnemyStatus(state, "stun", actualDamage), combatTexts);
}

function applyFrozenHeartDamage(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (state.trinketEffects.frozenHeartDamage <= 0) return state;
  const dmg = state.trinketEffects.frozenHeartDamage;
  mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "physical", amount: dmg });
  return {
    ...state,
    enemyHealth: clampHealth(state.enemyHealth, -dmg, state.enemyMaxHealth),
  };
}

function tryTriggerEnemyFreeze(
  preHitState: BattleState,
  nextState: BattleState,
  combatTexts: CombatTextEvent[],
): BattleState {
  const isFreezeImmune = preHitState.currentEnemy.traits.some((t) => t.id === ENEMY_TRAIT_IDS.GLACIAL_SHELL);
  const freezeThreshold = FREEZE_THRESHOLD_FRACTION - (preHitState.talentEffects.freezeThresholdReduction ?? 0);
  if (
    isFreezeImmune ||
    preHitState.enemyHealth <= 0 ||
    nextState.enemyStatuses.freeze < preHitState.enemyHealth * freezeThreshold
  ) {
    return nextState;
  }

  const immuneClear = applyEnemyCcImmunityClear({
    nextState,
    stat: "freeze",
    ccCooldown: preHitState.enemyCCCooldown,
  });
  if (immuneClear) return immuneClear;

  const skipDuration = BATTLE_CONFIG.BASE_CC_DURATION + nextState.trinketEffects.freezeDurationExtension;
  const result = assignEnemyCrowdControlSkip({ nextState, stat: "freeze", skipDuration, combatTexts });
  return applyFrozenHeartDamage(result, combatTexts);
}

function applyFreezeStatusRider(state: BattleState, actualDamage: number, combatTexts: CombatTextEvent[]): BattleState {
  const nextState = addEnemyStatus(state, "freeze", actualDamage);
  return tryTriggerEnemyFreeze(state, nextState, combatTexts);
}

export function applyDamageStatuses(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
) {
  switch (effect.damageType) {
    case "burn":
      return applyBurnStatusRider(state, actualDamage);
    case "poison":
      return applyPoisonStatusRider(state, actualDamage, combatTexts);
    case "bleed": {
      const statusDamage = adjustEnemyStatusDelta(state, actualDamage);
      return applyBleedStatusRider(state, effect, actualDamage, statusDamage, combatTexts);
    }
    case "stun":
      return applyStunStatusRider(state, actualDamage, combatTexts);
    case "freeze":
      return applyFreezeStatusRider(state, actualDamage, combatTexts);
    default:
      return state;
  }
}

function clearHarmfulStatuses(playerStatuses: BattleState["playerStatuses"], amount: number) {
  const nextPlayerStatuses = { ...playerStatuses };
  let removed = 0;
  for (const statusId of harmfulPlayerStatusIds) {
    if (removed >= amount) break;
    if (nextPlayerStatuses[statusId] > 0) {
      nextPlayerStatuses[statusId] = 0;
      removed++;
    }
  }
  return { nextPlayerStatuses, removed };
}

export function removeHarmfulPlayerStatuses(state: BattleState, amount: number, combatTexts?: CombatTextEvent[]) {
  const { nextPlayerStatuses, removed } = clearHarmfulStatuses(state.playerStatuses, amount);
  let nextState = { ...state, playerStatuses: nextPlayerStatuses };
  if (removed && nextState.trinketEffects.sinEaterHealOnHarmfulStatusRemove > 0) {
    nextState = applyPlayerHealing(nextState, nextState.trinketEffects.sinEaterHealOnHarmfulStatusRemove);
    if (combatTexts) {
      mergeCombatText(combatTexts, {
        target: "player",
        kind: "heal",
        stat: "health",
        amount: nextState.trinketEffects.sinEaterHealOnHarmfulStatusRemove,
      });
    }
  }
  return nextState;
}

function scaleArmorAmount(state: BattleState, amount: number): { state: BattleState; amount: number } {
  let nextAmount = amount;
  let nextState = state;
  if (
    nextState.talentEffects.armorDoubledBelowHalfHealth &&
    nextState.playerHealth <= nextState.playerMaxHealth / HALF_DIVISOR
  ) {
    nextAmount *= FIRST_EFFECT_MULTIPLIER;
  }
  if (nextState.talentEffects.firstArmorCardDoubled && !nextState.flags.firstArmorCardDoubledUsed) {
    nextAmount *= FIRST_EFFECT_MULTIPLIER;
    nextState = setFlag(nextState, "firstArmorCardDoubledUsed", true);
  }
  return { state: nextState, amount: nextAmount };
}

function procArmorBlockThreshold(state: BattleState, newArmor: number, combatTexts: CombatTextEvent[]) {
  if (
    state.talentEffects.armorBlockThreshold <= 0 ||
    state.playerStatuses.armor >= state.talentEffects.armorBlockThreshold ||
    newArmor < state.talentEffects.armorBlockThreshold
  ) {
    return state;
  }
  mergeCombatText(combatTexts, {
    target: "player",
    kind: "status",
    stat: "block",
    amount: state.talentEffects.armorBlockAmount,
  });
  return {
    ...state,
    playerStatuses: {
      ...state.playerStatuses,
      block: state.playerStatuses.block + state.talentEffects.armorBlockAmount,
    },
  };
}

function applyArmorTalentChecks(state: BattleState, amount: number, combatTexts: CombatTextEvent[]) {
  const scaled = scaleArmorAmount(state, amount);
  const newArmor = scaled.state.playerStatuses.armor + scaled.amount;
  const withBlock = procArmorBlockThreshold(scaled.state, newArmor, combatTexts);
  return { state: withBlock, amount: scaled.amount };
}

export function applyPlayerStatusEffect(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "player-status" }>,
  combatTexts: CombatTextEvent[],
) {
  let amount = effect.amount;
  if (effect.status === "armor") {
    const checked = applyArmorTalentChecks(state, amount, combatTexts);
    state = checked.state;
    amount = checked.amount;
  }
  if (effect.status === "block" && state.talentEffects.forgeToBlock) {
    amount += state.playerStatuses.forge;
  }
  if (effect.status === "forge") {
    const oldForge = state.playerStatuses.forge;
    state = applyForgeBurnBurst(state, oldForge, oldForge + amount, combatTexts);
  }
  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: effect.status, amount });
  return addPlayerStatus(state, effect.status, amount);
}
