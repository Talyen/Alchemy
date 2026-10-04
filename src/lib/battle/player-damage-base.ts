import { readCombatFlag } from "./action-context";
import {
  isPotionCard,
  type BattleCard,
  type BattleCardEffect,
  type DamageType,
  type TalentEffectManifest,
} from "@/lib/game-data";
import { BURN_BLOCK_SCALED_DAMAGE_PERCENT, PERCENT_DENOMINATOR } from "../game-constants";
import { scalePercent, scalePerMana } from "./amount-helpers";
import { flatDamageBonus } from "./damage-modifiers";
import { getPoisonBonusAgainstBleeding, getPoisonDamageMultiplierAgainstBleeding } from "./status-helpers";
import type { BattleState } from "./types";

function forgeDamagePercent(
  damageType: DamageType,
  talents: TalentEffectManifest,
  gear?: BattleState["gearEffects"],
  companionAttack = false,
): number {
  if (companionAttack && (gear?.companionBenefitsFromForge ?? 0) > 0) return PERCENT_DENOMINATOR;
  // Full-strength Homestead/Gear grants take precedence;
  // overlapping permissions do not award Forge twice.
  const burn = Math.max(talents.forgeBurnDamagePercent, talents.homesteadForgeBurnPercent ?? 0);
  const bleed = talents.forgeBleedDamagePercent;
  const shared = (gear?.sharedBurnBleedBonuses ?? 0) > 0;
  switch (damageType) {
    case "physical":
    case "stun":
      return PERCENT_DENOMINATOR;
    case "holy":
      return (gear?.holyPreservesForge ?? 0) > 0 || (gear?.goldGrantsForgeAndHoly ?? 0) > 0
        ? PERCENT_DENOMINATOR
        : talents.forgeHolyDamagePercent;
    case "burn":
      return shared ? Math.max(burn, bleed) : burn;
    case "bleed":
      return shared ? Math.max(burn, bleed) : bleed;
    case "poison":
    case "freeze":
    case "nature":
      return 0;
  }
}

export function forgeAppliesToDamageType(
  damageType: DamageType,
  talentEffects: TalentEffectManifest,
  gearEffects?: BattleState["gearEffects"],
  companionAttack = false,
): boolean {
  return forgeDamagePercent(damageType, talentEffects, gearEffects, companionAttack) > 0;
}

function blockScaledDamage(state: BattleState, percent: number): number {
  return scalePercent(state.playerStatuses.block, percent, PERCENT_DENOMINATOR);
}

function getForgeBonusForDamage(state: BattleState, damageType: DamageType, companionAttack = false): number {
  if (!forgeAppliesToDamageType(damageType, state.talentEffects, state.gearEffects, companionAttack)) return 0;
  const forge = state.playerStatuses.forge;
  if (damageType === "physical" && state.talentEffects.forgeToPhysicalDamageMultiplier > 0) {
    return forge * state.talentEffects.forgeToPhysicalDamageMultiplier;
  }
  return scalePercent(forge, forgeDamagePercent(damageType, state.talentEffects, state.gearEffects, companionAttack));
}

function computeBaseRawAmount(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  card?: BattleCard,
  companionAttack = false,
): number {
  const forgeBonus = getForgeBonusForDamage(state, effect.damageType, companionAttack);

  // Forge replaces the base; the other resource attacks can also use Forge.
  let amount: number;
  if (effect.equalToForge) {
    amount = state.playerStatuses.forge;
  } else if (effect.equalToBlock) {
    amount = scalePercent(state.playerStatuses.block, effect.equalToBlockPercent ?? PERCENT_DENOMINATOR) + forgeBonus;
  } else if (effect.equalToArmor) {
    amount = state.playerStatuses.armor + forgeBonus;
  } else if (effect.equalToGoldPercent) {
    amount = scalePercent(state.gold, effect.equalToGoldPercent, PERCENT_DENOMINATOR) + forgeBonus;
  } else {
    amount = effect.amount + forgeBonus;
  }
  if (card?.tags?.includes("archery")) {
    amount += state.talentEffects.flatArrowDamage + state.gearEffects.flatArrowDamage;
    if (readCombatFlag(state, "archerySecondCardActive")) {
      amount += state.talentEffects.archerySecondCardDamage;
    }
    if (state.playerStatuses.block === 0) amount += state.talentEffects.archeryDamageWithoutBlock;
  }
  return amount;
}

function applyDamageTypeModifiers(state: BattleState, damageType: DamageType, rawAmount: number): number {
  let amount = rawAmount + flatDamageBonus(state, damageType);
  switch (damageType) {
    case "physical":
      amount += scalePercent(state.playerStatuses.armor, state.talentEffects.armorPhysicalDamagePercent);
      if (state.talentEffects.blockToPhysicalDamageMultiplier > 0)
        amount += Math.round(state.playerStatuses.block * state.talentEffects.blockToPhysicalDamageMultiplier);
      if (state.enemyStatuses.poison > 0) amount += state.talentEffects.poisonPhysicalBonus;
      if (state.enemyStatuses.bleed > 0) amount += state.talentEffects.bleedPhysicalBonus;
      return amount;
    case "holy":
      amount += scalePercent(state.gold, state.talentEffects.holyGoldPercent, PERCENT_DENOMINATOR);
      amount += scalePercent(
        state.playerStatuses.block,
        state.gearEffects.holyDamageFromBlockPercent,
        PERCENT_DENOMINATOR,
      );
      amount += scalePercent(state.gold, state.gearEffects.holyDamageFromGoldPercent, PERCENT_DENOMINATOR);
      return amount + blockScaledDamage(state, state.talentEffects.blockHolyDamagePercent);
    case "bleed":
      return amount;
    case "stun":
      return amount + blockScaledDamage(state, state.talentEffects.blockStunDamagePercent);
    case "burn":
      if (state.talentEffects.burnDamagePerMana > 0)
        amount += scalePerMana(state.mana, state.talentEffects.burnDamagePerMana, "percent");
      else if (state.talentEffects.burnDamagePerManaCrystal > 0)
        amount += scalePerMana(state.maxMana, state.talentEffects.burnDamagePerManaCrystal, "percent");
      return state.talentEffects.blockToBurnDamage
        ? amount + blockScaledDamage(state, BURN_BLOCK_SCALED_DAMAGE_PERCENT)
        : amount;
    case "freeze":
      if (state.talentEffects.freezeDamagePerMana > 0)
        amount += scalePerMana(state.mana, state.talentEffects.freezeDamagePerMana, "percent");
      else if (state.talentEffects.freezeDamagePerManaCrystal > 0)
        amount += scalePerMana(state.maxMana, state.talentEffects.freezeDamagePerManaCrystal, "half");
      return amount;
    case "nature":
      amount += scalePercent(state.playerStatuses.armor, state.talentEffects.armorNatureDamagePercent);
      return amount + (state.enemyStatuses.poison > 0 ? state.talentEffects.natureBonusVsPoisoned : 0);
    case "poison":
      return Math.round(
        (amount + getPoisonBonusAgainstBleeding(state)) * getPoisonDamageMultiplierAgainstBleeding(state),
      );
  }
}

export function computeBaseDamage(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  {
    card,
    bonus = 0,
    companionAttack = false,
  }: {
    card?: BattleCard | undefined;
    bonus?: number | undefined;
    companionAttack?: boolean;
  } = {},
): number {
  // These bonuses enlarge the original packet; they do not create follow-up hits.
  const poisonPotionBonus =
    card && !companionAttack && isPotionCard(card) && effect.damageType === "poison"
      ? state.talentEffects.poisonDamageOnConsume
      : 0;
  const consumeBurnBonus =
    card?.consume && !companionAttack && effect.damageType === "burn" ? state.gearEffects.burnOnConsume : 0;
  const potionBonus =
    card && !companionAttack && isPotionCard(card) ? (state.talentEffects.homesteadPotionBonus ?? 0) : 0;
  const rawAmount =
    computeBaseRawAmount(state, effect, card, companionAttack) +
    bonus +
    poisonPotionBonus +
    consumeBurnBonus +
    potionBonus;
  const hasBlock = effect.equalToBlock === true;
  const hasArmor = effect.equalToArmor === true;
  const hasGold = effect.equalToGoldPercent !== undefined;
  const isEqualTo = hasBlock || hasArmor || hasGold || effect.equalToForge === true;
  const vulnerabilityBonus =
    (state.enemyCC.freezeSkipTurns > 0 ? state.talentEffects.freezeDamageBonusVsFrozen : 0) +
    (state.enemyStatuses.poison > 0 ? state.talentEffects.poisonDamageBonusVsPoisoned : 0);
  if (isEqualTo) return Math.max(0, rawAmount + (rawAmount > 0 ? vulnerabilityBonus : 0));
  const sharedBonus =
    state.gearEffects.sharedBurnBleedBonuses <= 0
      ? 0
      : effect.damageType === "burn"
        ? applyDamageTypeModifiers(state, "bleed", 0)
        : effect.damageType === "bleed"
          ? applyDamageTypeModifiers(state, "burn", 0)
          : 0;
  const amount = applyDamageTypeModifiers(state, effect.damageType, rawAmount) + sharedBonus;
  // Keep vulnerability bonuses inside the existing type-scaling stage, but
  // require a positive packet before they can enlarge it.
  return Math.max(
    0,
    amount > 0 && vulnerabilityBonus > 0
      ? applyDamageTypeModifiers(state, effect.damageType, rawAmount + vulnerabilityBonus) + sharedBonus
      : amount,
  );
}
