import { readCombatFlag } from "./action-context";
import {
  isPotionCard,
  type BattleCard,
  type BattleCardEffect,
  type DamageType,
  type TalentEffectManifest,
} from "@/lib/game-data";
import { PERCENT_DENOMINATOR } from "../game-constants";
import { scalePercent } from "./amount-helpers";
import { flatDamageBonus } from "./damage-modifiers";
import {
  getEnemyDamageVulnerabilityBonus,
  getPoisonBonusAgainstBleeding,
  getPoisonDamageMultiplierAgainstBleeding,
} from "./status-helpers";
import type { BattleState } from "./types";

function forgeDamagePercent(
  damageType: DamageType,
  talents: TalentEffectManifest,
  gear?: BattleState["gearEffects"],
): number {
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
      return (gear?.oathkeeperHolyAndBlock ?? 0) > 0 || (gear?.goldGrantsForgeAndHoly ?? 0) > 0
        ? Math.max(50, talents.forgeHolyDamagePercent)
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

function blockScaledDamage(state: BattleState, percent: number): number {
  return scalePercent(state.playerStatuses.block, percent, PERCENT_DENOMINATOR);
}

function getForgeBonusForDamage(state: BattleState, damageType: DamageType): number {
  const percent = forgeDamagePercent(damageType, state.talentEffects, state.gearEffects);
  if (!(percent > 0)) return 0;
  const forge = state.playerStatuses.forge;
  if (damageType === "physical" && state.talentEffects.forgeToPhysicalDamageMultiplier > 0) {
    // Round the converted Forge bonus like every other magnitude so damage
    // multipliers apply to an integer, matching Shield Slam's Block scaling.
    return Math.round(forge * state.talentEffects.forgeToPhysicalDamageMultiplier);
  }
  return scalePercent(forge, percent);
}

function computeBaseRawAmount(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  card?: BattleCard,
): number {
  const forgeBonus = getForgeBonusForDamage(state, effect.damageType);

  // Explicit Forge scaling replaces the usual Forge bonus.
  let amount: number;
  if (effect.forgeBonusPercent !== undefined) {
    amount = effect.amount + scalePercent(state.playerStatuses.forge, effect.forgeBonusPercent);
  } else if (effect.equalToBlock) {
    amount = scalePercent(state.playerStatuses.block, effect.equalToBlockPercent ?? PERCENT_DENOMINATOR) + forgeBonus;
  } else if (effect.equalToArmor) {
    amount = state.playerStatuses.armor + forgeBonus;
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
        amount += scalePercent(state.mana, state.talentEffects.burnDamagePerMana);
      return amount;
    case "freeze":
      if (state.talentEffects.freezeDamagePerMana > 0)
        amount += scalePercent(state.mana, state.talentEffects.freezeDamagePerMana);
      return amount;
    case "nature":
      return amount;
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
    computeBaseRawAmount(state, effect, card) + bonus + poisonPotionBonus + consumeBurnBonus + potionBonus;
  const hasBlock = effect.equalToBlock === true;
  const hasArmor = effect.equalToArmor === true;
  const isEqualTo = hasBlock || hasArmor;
  const vulnerabilityBonus = getEnemyDamageVulnerabilityBonus(state);
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
