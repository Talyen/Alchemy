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
  type CombatTextEvent, // used by internal helpers and re-exported callers
} from "./types";
import { emitOverhealBlockText, mergeCombatText } from "./combat-text";
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
  TRAIT_DAMAGE_RULES,
  TRAIT_DAMAGE_WEAKNESS,
  BATTLE_CONFIG,
} from "../game-constants";

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
    mergeCombatText(combatTexts, {
      target: "enemy",
      kind: "damage",
      stat: "burn",
      amount: burnAmount,
    });
  }
  return nextState;
}

function applyForgeStripArmorBurst(state: BattleState, oldForge: number, newForge: number): BattleState {
  if (
    state.talentEffects.forgeStripArmorThreshold <= 0 ||
    oldForge >= state.talentEffects.forgeStripArmorThreshold ||
    newForge < state.talentEffects.forgeStripArmorThreshold ||
    state.enemyMitigation.armor <= 0
  ) {
    return state;
  }
  return { ...state, enemyMitigation: { ...state.enemyMitigation, armor: 0 } };
}

function applyForgeBlockBurst(
  state: BattleState,
  oldForge: number,
  newForge: number,
  combatTexts?: CombatTextEvent[],
): BattleState {
  if (
    state.talentEffects.forgeBlockThreshold <= 0 ||
    oldForge >= state.talentEffects.forgeBlockThreshold ||
    newForge < state.talentEffects.forgeBlockThreshold
  ) {
    return state;
  }
  let amount = state.talentEffects.forgeBlockAmount;
  if (state.talentEffects.forgeToBlock) {
    amount += newForge;
  }
  if (combatTexts) {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat: "block",
      amount,
    });
  }
  return addPlayerStatus(state, "block", amount);
}

function addForgeToPlayer(state: BattleState, baseAmount: number, combatTexts?: CombatTextEvent[]): BattleState {
  let amount = baseAmount + state.talentEffects.flatForgeGained;
  if (state.talentEffects.forgeDoubledBelowHalfHealth && state.playerHealth <= state.playerMaxHealth / HALF_DIVISOR) {
    amount *= 2;
  }
  if (amount <= 0) return state;
  const oldForge = state.playerStatuses.forge;
  const newForge = oldForge + amount;
  let nextState = addPlayerStatus(state, "forge", amount);
  nextState = applyForgeBurnBurst(nextState, oldForge, newForge, combatTexts);
  nextState = applyForgeStripArmorBurst(nextState, oldForge, newForge);
  nextState = applyForgeBlockBurst(nextState, oldForge, newForge, combatTexts);
  if (combatTexts) {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat: "forge",
      amount,
    });
  }
  return nextState;
}

// Named helpers split from applyStunTalentEffects to follow SRP

function applyStunDrawTalent(state: BattleState): BattleState {
  if (state.talentEffects.drawOnStun <= 0) return state;
  const draw = drawCards(state.deck, state.discard, state.hand, state.talentEffects.drawOnStun, state.nextCardUid);
  return {
    ...state,
    deck: draw.deck,
    discard: draw.discard,
    hand: draw.hand,
    nextCardUid: draw.nextCardUid,
  };
}

function applyStunFreeCardTalent(state: BattleState): BattleState {
  if (!state.talentEffects.nextCardFreeOnStun) return state;
  return setFlag(state, "nextCardCostReduction", FREE_CARD_SENTINEL);
}

function applyBlockOnCCTalent(state: BattleState, amount: number, combatTexts?: CombatTextEvent[]): BattleState {
  if (amount <= 0) return state;
  const nextState = addPlayerStatus(state, "block", amount);
  if (combatTexts) {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat: "block",
      amount,
    });
  }
  return nextState;
}

const applyStunBlockTalent = (state: BattleState, combatTexts?: CombatTextEvent[]) =>
  applyBlockOnCCTalent(state, state.talentEffects.blockOnStun, combatTexts);

function applyStunForgeTalent(state: BattleState, combatTexts?: CombatTextEvent[]): BattleState {
  if (state.talentEffects.forgeOnStun <= 0) return state;
  return addForgeToPlayer(state, state.talentEffects.forgeOnStun, combatTexts);
}

function applyStripArmorOnCCTalent(state: BattleState, active: boolean): BattleState {
  if (!active || state.enemyMitigation.armor <= 0) return state;
  return { ...state, enemyMitigation: { ...state.enemyMitigation, armor: 0 } };
}

const applyStunStripArmorTalent = (state: BattleState) =>
  applyStripArmorOnCCTalent(state, state.talentEffects.stunStripArmor);

function applyStunManaTalent(state: BattleState, combatTexts?: CombatTextEvent[]): BattleState {
  if (state.talentEffects.manaOnStun <= 0) return state;
  const nextState = { ...state, mana: state.mana + state.talentEffects.manaOnStun };
  if (combatTexts) {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat: "mana",
      amount: state.talentEffects.manaOnStun,
    });
  }
  return nextState;
}

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

function applyStunTrinketEffects(state: BattleState, combatTexts?: CombatTextEvent[]): BattleState {
  let nextState = state;
  if (nextState.trinketEffects.thunderstoneDamageOnStun > 0) {
    const dmg = nextState.trinketEffects.thunderstoneDamageOnStun;
    nextState = {
      ...nextState,
      enemyHealth: clampHealth(nextState.enemyHealth, -dmg, nextState.enemyMaxHealth),
    };
    if (combatTexts) {
      mergeCombatText(combatTexts, {
        target: "enemy",
        kind: "damage",
        stat: "nature",
        amount: dmg,
      });
    }
    nextState = applyLuckyCloverGold(nextState, dmg, combatTexts ?? []);
  }
  return nextState;
}

/** Enemy stun threshold — runs immediately when stun stacks are added from damage. */
export function resolveStunTrigger(state: BattleState, combatTexts?: CombatTextEvent[]) {
  const threshold = STUN_THRESHOLD_FRACTION - (state.talentEffects.stunThresholdReduction ?? 0);
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
  nextState = applyPoisonTalentRiders(nextState, actualDamage, combatTexts);
  return nextState;
}

export function applyPoisonTalentRiders(
  state: BattleState,
  damage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  let nextState = state;
  if (damage > 0 && rollPercent(nextState.talentEffects.poisonStunChance, nextState.rng)) {
    nextState = resolveStunTrigger(addEnemyStatus(nextState, "stun", damage), combatTexts);
  }
  if (nextState.talentEffects.poisonStripArmor && nextState.enemyMitigation.armor > 0) {
    nextState = {
      ...nextState,
      enemyMitigation: { ...nextState.enemyMitigation, armor: Math.max(0, nextState.enemyMitigation.armor - 1) },
    };
  }
  if (damage > 0 && rollPercent(nextState.talentEffects.poisonLeechChance, nextState.rng)) {
    const prevState = nextState;
    nextState = applyPlayerHealing(nextState, damage);
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "heal",
      stat: "health",
      amount: damage,
    });
    emitOverhealBlockText(prevState, nextState, combatTexts);
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
  const leechFromTalent = rollPercent(state.talentEffects.bleedLeechChance, state.rng);
  if (!leechFromCard && !leechFromTalent) return state;
  return { ...state, pendingBleedLeechHealing: state.pendingBleedLeechHealing + bleedAmount };
}

function procBleedPoison(state: BattleState, actualDamage: number, bleedAmount: number): BattleState {
  if (bleedAmount <= 0 || actualDamage <= 0 || !rollPercent(state.talentEffects.bleedPoisonChance, state.rng))
    return state;
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
  mergeCombatText(combatTexts, {
    target: "enemy",
    kind: "damage",
    stat: "physical",
    amount: dmg,
  });
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
  let result = assignEnemyCrowdControlSkip({
    nextState,
    stat: "freeze",
    skipDuration,
    combatTexts,
  });
  result = applyFrozenHeartDamage(result, combatTexts);
  result = applyFreezeBlockTalent(result, combatTexts);
  result = applyFreezeStripArmorTalent(result);
  return result;
}

const applyFreezeBlockTalent = (state: BattleState, combatTexts?: CombatTextEvent[]) =>
  applyBlockOnCCTalent(state, state.talentEffects.blockOnFreeze, combatTexts);

const applyFreezeStripArmorTalent = (state: BattleState) =>
  applyStripArmorOnCCTalent(state, state.talentEffects.freezeStripArmor);

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
    // Flattened loop using guard clause
    if (nextPlayerStatuses[statusId] <= 0) continue;
    nextPlayerStatuses[statusId] = 0;
    removed++;
  }
  return { nextPlayerStatuses, removed };
}

function applyHealOnStatusRemove(state: BattleState, amount: number, combatTexts?: CombatTextEvent[]): BattleState {
  if (amount <= 0) return state;
  const prevState = state;
  const nextState = applyPlayerHealing(state, amount);
  if (combatTexts) {
    mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount });
    emitOverhealBlockText(prevState, nextState, combatTexts);
  }
  return nextState;
}

export function removeHarmfulPlayerStatuses(state: BattleState, amount: number, combatTexts?: CombatTextEvent[]) {
  const { nextPlayerStatuses, removed } = clearHarmfulStatuses(state.playerStatuses, amount);
  let nextState = { ...state, playerStatuses: nextPlayerStatuses };
  if (removed) {
    nextState = applyHealOnStatusRemove(
      nextState,
      nextState.trinketEffects.sinEaterHealOnHarmfulStatusRemove,
      combatTexts,
    );
    nextState = applyHealOnStatusRemove(nextState, nextState.talentEffects.healOnStatusCleanse, combatTexts);
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

function procArmorCleanseThreshold(state: BattleState, newArmor: number, combatTexts: CombatTextEvent[]) {
  if (
    state.talentEffects.armorCleanseThreshold <= 0 ||
    state.playerStatuses.armor >= state.talentEffects.armorCleanseThreshold ||
    newArmor < state.talentEffects.armorCleanseThreshold
  ) {
    return state;
  }
  return removeHarmfulPlayerStatuses(state, harmfulPlayerStatusIds.length, combatTexts);
}

function applyArmorTalentChecks(state: BattleState, amount: number, combatTexts: CombatTextEvent[]) {
  const scaled = scaleArmorAmount(state, amount);
  const newArmor = scaled.state.playerStatuses.armor + scaled.amount;
  const withBlock = procArmorBlockThreshold(scaled.state, newArmor, combatTexts);
  const withCleanse = procArmorCleanseThreshold(withBlock, newArmor, combatTexts);
  return { state: withCleanse, amount: scaled.amount };
}

export function applyPlayerStatusEffect(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "player-status" }>,
  combatTexts: CombatTextEvent[],
) {
  let amount = effect.amount;
  if (effect.status === "armor") {
    amount += state.talentEffects.flatArmorAmount;
    const checked = applyArmorTalentChecks(state, amount, combatTexts);
    state = checked.state;
    amount = checked.amount;
  }
  if (effect.status === "block" && state.talentEffects.forgeToBlock) {
    amount += state.playerStatuses.forge;
  }
  if (effect.status === "forge") {
    return addForgeToPlayer(state, amount, combatTexts);
  }
  mergeCombatText(combatTexts, {
    target: "player",
    kind: "status",
    stat: effect.status,
    amount,
  });
  return addPlayerStatus(state, effect.status, amount);
}

export function applyPlayerDamageStatuses(
  state: BattleState,
  effect: { damageType: string },
  actualDamage: number,
): BattleState {
  if (actualDamage <= 0) return state;
  const statusType = effect.damageType;
  if (
    statusType === "burn" ||
    statusType === "poison" ||
    statusType === "bleed" ||
    statusType === "freeze" ||
    statusType === "stun"
  ) {
    const adjustedDamage =
      statusType === "freeze" && state.talentEffects.receiveHalfFreezeBuildUp
        ? Math.round(actualDamage / 2)
        : actualDamage;
    return {
      ...state,
      playerStatuses: {
        ...state.playerStatuses,
        [statusType]: state.playerStatuses[statusType] + adjustedDamage,
      },
    };
  }
  return state;
}
