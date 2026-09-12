import { type BattleCard, type BattleCardEffect } from "@/lib/game-data";
import { BATTLE_CONFIG, BLACKFLETCH_EXECUTE_HEALTH_PERCENT } from "../game-constants";
import { halveRounded } from "./amount-helpers";
import { applyLuckyCloverGold, applyNatureManaRefund } from "./bonus-effects";
import { mergeCombatText, payKillPayouts } from "./combat-text";
import { computeReflectedHolyDamageToEnemy, forgeAppliesToDamageType } from "./damage-calc";
import { applyDamageBlock, applyHolyLifesteal, applyHolyTithe } from "./damage-rider-leech";
import { applyDamageStatuses } from "./damage-status-riders";
import { detonateEnemyStatuses } from "./dot-resolve";
import { processEncounterTraitHealthThreshold } from "./encounter-trait-health-threshold";
import { paceCombatDamage } from "./fight-pacing";
import {
  applyBrassCenser,
  applyLifestealAndPlayerHitTriggers,
  applyNatureLeech,
  applyTalentHitConversions,
  dealPlayerTypedHit,
  dealTalentTypedHit,
  tryPoisonStunProc,
  tryTalentTypedHit,
} from "./player-typed-hit";
import { decayArmorAfterDamage, getEnemyDamageMultiplier, rollTalentChance } from "./status-helpers";
import { addForgeToPlayer, spendPlayerForgeForAttack } from "./status-player";
import {
  addEnemyStatus,
  damageEnemyHealth,
  hasEncounterBenefit,
  setFlag,
  type BattleState,
  type CombatTextEvent,
} from "./types";
import { applyWishEffect } from "./wish";

function applyBurnDamageRiders(
  state: BattleState,
  modifiedDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  let nextState = state;
  if (state.talentEffects.forgeOnBurnDealt > 0) {
    nextState = addForgeToPlayer(nextState, state.talentEffects.forgeOnBurnDealt, combatTexts);
  }
  if (state.gearEffects.forgeOnBurnDealt > 0 && !state.flags.emberforgedUsedThisTurn) {
    nextState = setFlag(
      addForgeToPlayer(nextState, state.gearEffects.forgeOnBurnDealt, combatTexts),
      "emberforgedUsedThisTurn",
      true,
    );
  }
  if (rollTalentChance(state.talentEffects.burnStunChance, state)) {
    nextState = dealTalentTypedHit(nextState, "stun", modifiedDamage, combatTexts, true);
  }
  return nextState;
}

function applyNatureDamageRiders(
  state: BattleState,
  modifiedDamage: number,
  _card: BattleCard,
  combatTexts: CombatTextEvent[],
  enemyHealthBeforeHit: number,
): BattleState {
  if (modifiedDamage <= 0) return state;
  let nextState = applyLuckyCloverGold(state, modifiedDamage, combatTexts);
  nextState = applyNatureManaRefund(nextState, modifiedDamage, combatTexts);
  if (state.talentEffects.natureLeechChance > 0 || state.gearEffects.natureLeechChance > 0) {
    nextState = applyNatureLeech(nextState, modifiedDamage, combatTexts, enemyHealthBeforeHit);
  }
  nextState = applyTalentHitConversions(nextState, "nature", modifiedDamage, combatTexts);
  if (rollTalentChance(state.talentEffects.naturePoisonChance, state)) {
    nextState = addEnemyStatus(nextState, "poison", modifiedDamage);
  }
  if (rollTalentChance(state.talentEffects.natureBleedChance, state)) {
    nextState = addEnemyStatus(nextState, "bleed", modifiedDamage);
  }
  if (rollTalentChance(state.talentEffects.natureStunChance, state)) {
    nextState = dealTalentTypedHit(nextState, "stun", modifiedDamage, combatTexts, true);
  }
  return nextState;
}

function applyForgeStunRider(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  combatTexts: CombatTextEvent[],
) {
  if (
    effect.damageType !== "physical" ||
    state.trinketEffects.forgeStunThreshold <= 0 ||
    state.playerStatuses.forge < state.trinketEffects.forgeStunThreshold
  )
    return state;

  return dealPlayerTypedHit(state, "stun", state.trinketEffects.forgeStunAmount, combatTexts);
}

function applyHolyDamageRiders(
  state: BattleState,
  card: BattleCard,
  damage: number,
  combatTexts: CombatTextEvent[],
  enemyHealthBeforeHit: number,
) {
  let nextState = applyHolyLifesteal(state, damage, combatTexts);
  nextState = applyDamageBlock(nextState, damage, combatTexts);
  nextState = applyHolyTithe(nextState, damage, combatTexts);

  nextState = applyTalentHitConversions(nextState, "holy", damage, combatTexts);
  if (rollTalentChance(nextState.talentEffects.holyBurnChance, nextState)) {
    nextState = addEnemyStatus(nextState, "burn", damage);
  }

  if (rollTalentChance(nextState.talentEffects.holyWishChance, nextState)) {
    nextState = applyWishEffect(nextState, card, 1, combatTexts);
  }

  return applyBrassCenser(nextState, damage, combatTexts, enemyHealthBeforeHit);
}

export function reflectBlockedAttackAsHoly(
  state: BattleState,
  blockLost: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  const { state: mitigated, remainingDamage } = computeReflectedHolyDamageToEnemy(state, blockLost);
  if (remainingDamage <= 0) return mitigated;
  const hit = damageEnemyHealth(mitigated, remainingDamage);
  let nextState = decayArmorAfterDamage(hit.state, remainingDamage, "enemy", combatTexts);
  mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "holy", amount: remainingDamage });
  const card = { id: "sun-struck-shield", title: "", descriptionLines: [], art: "", cost: 0, effects: [] };
  nextState = payKillPayouts(nextState, hit.enemyWasAlive, combatTexts);
  nextState = applyDamageStatuses(
    nextState,
    { kind: "damage", damageType: "holy", amount: remainingDamage },
    remainingDamage,
    combatTexts,
    hit.previousHealth,
  );
  nextState = applyHolyDamageRiders(nextState, card, remainingDamage, combatTexts, hit.previousHealth);
  return processEncounterTraitHealthThreshold(hit.previousHealth, nextState, combatTexts);
}

function consumeForgeAfterDamage(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  damage: number,
  companionAttack = false,
) {
  if (hasEncounterBenefit(state, "white-heat")) return state;
  if (effect.damageType === "holy" && state.gearEffects.holyPreservesForge > 0) return state;
  const forgeWasApplied = forgeAppliesToDamageType(
    effect.damageType,
    state.talentEffects,
    state.gearEffects,
    companionAttack,
  );

  if (!forgeWasApplied || damage <= 0 || state.playerStatuses.forge <= 0) return state;

  return spendPlayerForgeForAttack(state, BATTLE_CONFIG.FORGE_DECAY_AMOUNT);
}

function applyArcheryDetonate(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (state.gearEffects.archeryDetonateBleedPoison <= 0 || state.enemyHealth <= 0) return state;
  if (state.enemyHealth * 100 >= state.enemyMaxHealth * BLACKFLETCH_EXECUTE_HEALTH_PERCENT) return state;
  return detonateEnemyStatuses(state, ["bleed", "poison"], combatTexts, "remaining-ticks");
}

export function applyAttackPurgeRider(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (state.gearEffects.attackPurgeDealHolyPerEffect <= 0 || state.enemyHealth <= 0) return state;
  const mitigation = state.enemyMitigation;
  const category =
    mitigation.armor > 0 ? "armor" : mitigation.block > 0 ? "block" : mitigation.forge > 0 ? "forge" : null;
  if (!category) return state;
  let nextState: BattleState = {
    ...state,
    enemyMitigation: { ...state.enemyMitigation, [category]: 0 },
  };
  const holyDamage = paceCombatDamage(
    nextState,
    Math.round(nextState.gearEffects.attackPurgeDealHolyPerEffect * getEnemyDamageMultiplier(nextState, "holy")),
    "player",
  );
  if (holyDamage > 0) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "holy", amount: holyDamage });
    const hit = damageEnemyHealth(nextState, holyDamage);
    nextState = processEncounterTraitHealthThreshold(hit.previousHealth, hit.state, combatTexts);
    nextState = payKillPayouts(nextState, hit.enemyWasAlive, combatTexts);
    nextState = applyBrassCenser(nextState, holyDamage, combatTexts, hit.previousHealth);
  }
  return nextState;
}

interface DamageRiderOptions {
  isExtraHit?: boolean | undefined;
  cardHealing?: boolean | undefined;
  companionAttack?: boolean | undefined;
  onDamageDealt?: ((amount: number) => void) | undefined;
}

export function applyDamageRiders(
  state: BattleState,
  card: BattleCard,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  modifiedDamage: number,
  combatTexts: CombatTextEvent[],
  options: DamageRiderOptions = {},
) {
  const { isExtraHit = false, cardHealing = false, companionAttack = false, onDamageDealt } = options;
  const enemyWasBurningBefore = state.enemyStatuses.burn > 0;
  const enemyWasStunned = state.enemyCC.stunSkipTurns > 0;
  const enemyWasFrozen = state.enemyCC.freezeSkipTurns > 0;
  // Capture target conditions before purge and secondary hits can change them.
  const prePurgeState = isExtraHit ? state : applyAttackPurgeRider(state, combatTexts);
  if (prePurgeState.enemyHealth <= 0) return prePurgeState;
  const hit = damageEnemyHealth(prePurgeState, modifiedDamage);
  const previousHealth = hit.previousHealth;
  onDamageDealt?.(hit.healthDamage);
  let nextState: BattleState = hit.state;

  nextState = decayArmorAfterDamage(nextState, modifiedDamage, "enemy");

  if (effect.damageType === "physical" || effect.damageType === "bleed") {
    nextState = applyTalentHitConversions(nextState, effect.damageType, modifiedDamage, combatTexts);
  }
  nextState = applyDamageStatuses(nextState, effect, modifiedDamage, combatTexts, previousHealth);
  if (effect.detonateIfEnemyBurning && enemyWasBurningBefore) {
    nextState = detonateEnemyStatuses(nextState, ["burn"], combatTexts);
  }
  if (modifiedDamage > 0) nextState = applyForgeStunRider(nextState, effect, combatTexts);
  if (effect.damageType === "physical" && modifiedDamage > 0) {
    const stunChance = nextState.talentEffects.physicalStunChance + nextState.gearEffects.physicalStunChance;
    if (rollTalentChance(stunChance, nextState)) {
      nextState = dealTalentTypedHit(nextState, "stun", modifiedDamage, combatTexts, true);
    }
  }
  if (effect.damageType === "poison") {
    nextState = tryPoisonStunProc(nextState, modifiedDamage, combatTexts);
  }

  if (effect.damageType === "burn" && modifiedDamage > 0) {
    nextState = applyBurnDamageRiders(nextState, modifiedDamage, combatTexts);
  }

  if (
    effect.lifesteal ||
    (effect.damageType === "physical" && enemyWasStunned && state.talentEffects.physicalLeechVsStunned)
  ) {
    nextState = applyLifestealAndPlayerHitTriggers(
      nextState,
      modifiedDamage,
      combatTexts,
      cardHealing && !!effect.lifesteal,
      !companionAttack && !!effect.lifesteal,
      previousHealth,
    );
  }

  if (modifiedDamage > 0 && enemyWasFrozen) {
    if (companionAttack)
      nextState = dealTalentTypedHit(
        nextState,
        "freeze",
        state.talentEffects.companionFreezeDamageVsFrozen,
        combatTexts,
      );
    if (card.tags?.includes("archery"))
      nextState = dealTalentTypedHit(nextState, "holy", state.talentEffects.archeryHolyDamageVsFrozen, combatTexts);
  }
  if (card.tags?.includes("archery") && modifiedDamage > 0) {
    if (!isExtraHit && rollTalentChance(nextState.talentEffects.archeryPlayTwiceChance, nextState)) {
      const secondHit = halveRounded(modifiedDamage);
      if (secondHit > 0) {
        nextState = applyDamageRiders(nextState, card, effect, secondHit, combatTexts, {
          ...options,
          isExtraHit: true,
        });
      }
    }

    if (!isExtraHit) {
      nextState = tryTalentTypedHit(
        nextState,
        state.talentEffects.archeryBleedDamageChance,
        "bleed",
        modifiedDamage,
        combatTexts,
      );
      if (rollTalentChance(state.talentEffects.archeryBleedChance, nextState)) {
        nextState = addEnemyStatus(nextState, "bleed", modifiedDamage);
      }
      nextState = applyArcheryDetonate(nextState, combatTexts);
    }
  }
  if (effect.damageType === "holy") {
    nextState = applyHolyDamageRiders(nextState, card, modifiedDamage, combatTexts, previousHealth);
  }

  if (effect.damageType === "nature") {
    nextState = applyNatureDamageRiders(nextState, modifiedDamage, card, combatTexts, previousHealth);
  }

  if (modifiedDamage > 0) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: effect.damageType, amount: modifiedDamage });
  }

  nextState = processEncounterTraitHealthThreshold(previousHealth, nextState, combatTexts);

  nextState = payKillPayouts(nextState, hit.enemyWasAlive, combatTexts);
  // Spend the Forge used by this hit before granting Forge earned from its frozen target.
  nextState = consumeForgeAfterDamage(nextState, effect, modifiedDamage, companionAttack);
  if (
    modifiedDamage > 0 &&
    enemyWasFrozen &&
    effect.damageType === "physical" &&
    state.talentEffects.forgeOnPhysicalVsFrozen > 0
  ) {
    nextState = addForgeToPlayer(nextState, state.talentEffects.forgeOnPhysicalVsFrozen, combatTexts);
  }
  return nextState;
}
