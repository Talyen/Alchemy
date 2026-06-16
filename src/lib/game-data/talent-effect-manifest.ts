// Pre-computed bonuses from unlocked talents, recalculated each battle start.
import type { CompanionId } from "./types";

export type TalentEffectManifest = {
  // --- Physical ---
  flatPhysicalDamage: number;
  armorToPhysicalDamage: boolean;
  physicalCritChance: number;
  firstPhysicalCardFree: boolean;
  physicalStunChance: number;
  physicalBleedChance: number;
  physicalDetonatesBleed: boolean;
  physicalDoubledBelowHalfHealth: boolean;
  physicalDoubledVsStunned: boolean;
  physicalDoubledVsFrozen: boolean;
  blockToPhysicalDamageMultiplier: number;
  forgeToPhysicalDamageMultiplier: number;

  // --- Stun ---
  stunThresholdReduction: number;
  drawOnStun: number;
  nextCardFreeOnStun: boolean;
  stunDurationExtension: number;
  stunDoubleDamage: boolean;
  flatStunDamage: number;
  blockOnStun: number;
  forgeOnStun: number;
  stunStripArmor: boolean;
  manaOnStun: number;

  // --- Block ---
  startBlock: number;
  blockPreventsBleed: boolean;
  blockPreventsPoison: boolean;
  blockPreventsStun: boolean;
  blockAbsorbPhysicalBonus: number;
  blockReduceBurnDamage: number;
  blockDepletedHeal: number;
  blockToHolyDamage: boolean;
  blockToStunDamage: boolean;

  // --- Forge ---
  startForge: number;
  forgeToBurn: boolean;
  forgeToHoly: boolean;
  forgeToBlock: boolean;
  forgeToBleed: boolean;
  forgeBurnThreshold: number;
  forgeBurnDamage: number;
  forgeStripArmorThreshold: number;
  flatForgeGained: number;
  forgeDoubledBelowHalfHealth: boolean;
  forgeBlockThreshold: number;
  forgeBlockAmount: number;

  // --- Armor ---
  armorMitigatesBurn: boolean;
  armorBlockThreshold: number;
  armorBlockAmount: number;
  armorDoubledBelowHalfHealth: boolean;
  firstArmorCardDoubled: boolean;
  startArmor: number;
  armorMitigatesBleed: boolean;
  armorBreakBlock: number;
  armorMitigatesStun: boolean;
  armorCleanseThreshold: number;
  flatArmorAmount: number;

  // --- Health ---
  campfireHealBonus: number;
  healthThresholdBlock: { threshold: number; amount: number } | null;
  maxHealthPerCombat: number;
  startHealth: number;
  healMultiplier: number;
  consumeHealMultiplier: number;
  healthThresholdArmor: { threshold: number; amount: number } | null;
  overhealToBlockRatio: number;
  healOnStatusCleanse: number;
  deathsDoorExtension: number;
  damageReduction: number;
  burnDamageReduction: number;
  freezeDamageReduction: number;
  natureDamageReduction: number;

  // --- Burn ---
  firstBurnCardDoubled: boolean;
  burnRemovesEnemyArmor: boolean;
  burnDoubleChance: number;
  receiveHalfBurnDamage: boolean;
  flatBurnDamage: number;
  burnOnWish: number;
  forgeOnBurnDealt: number;
  blockToBurnDamage: boolean;
  consumeBurnDamageBonusPercent: number;
  burnStunChance: number;

  // --- Gold ---
  shopCardDiscount: number;
  shopFreeRefresh: boolean;
  startGold: number;
  goldPerCombat: number;
  potionDiscount: number;
  potionPotency: number;
  potionMixPotency: number;
  removeCardDiscount: number;
  enemyGoldDropBonus: number;
  eliteGoldDropBonus: number;
  goldOnWish: number;
  mixPotionDiscount: number;

  // --- Companions ---
  companionBondLevels: Record<CompanionId, number>;

  // --- Holy ---
  holyLifestealPercent: number;
  firstHolyCardFree: boolean;
  holyGoldPercent: number;
  holyBurnChance: number;
  receiveHalfHolyDamage: boolean;
  holyBlockPercent: number;
  holyWishChance: number;
  holyBlockPercentFromDamage: number;
  holyVsBurnMultiplier: number;
  holyGoldChance: number;

  // --- Wish ---
  goldOnWishAmount: number;
  wishUndiscoveredCards: boolean;
  healthOnWish: number;
  removeHarmfulStatusOnWish: boolean;
  wishExtraChoiceChance: number;
  wishDrawsCard: boolean;
  manaOnWish: number;
  wishTrinketChoice: boolean;
  wishBlockBelowHealthPct: number;
  wishCardsUpgraded: boolean;

  // --- Poison ---
  firstPoisonCardFree: boolean;
  poisonPhysicalBonus: number;
  poisonGainChance: number;
  receiveHalfPoisonDamage: boolean;
  goldOnFirstPoison: number;
  poisonHalvesHealing: boolean;
  poisonStunChance: number;
  poisonStripArmor: boolean;
  poisonReducesEnemyDamage: number;
  poisonLeechChance: number;

  companionDamage: number;
  companionGoldFindActive: boolean;

  // --- Wishing Well ---
  wishCrystalGold: number;

  // --- Mana ---
  startMana: number;
  wellspringKeepMana: number;
  manaBulwarkActive: boolean;
  manaShellActive: boolean;
  burnDamagePerManaCrystal: number;
  freezeDamagePerManaCrystal: number;
  burnDamageOnManaCrystalLoss: number;
  companionDamagePerManaCrystal: number;
  healOnManaGain: number;

  // --- Trinket ---
  trinketChanceBonus: number;

  // --- Freeze ---
  freezeThresholdReduction: number;
  freezeDoubleDamage: boolean;
  blockOnFreeze: number;
  freezeStripArmor: boolean;
  startFreeze: number;
  companionVsFrozenBonus: number;
  freezePreventsPoisonDecay: boolean;
  freezeBlocksRegen: boolean;
  freezePreventsEnemyScaling: boolean;
  receiveHalfFreezeBuildUp: boolean;
  flatFreezeDamage: number;

  // --- Arrow ---
  flatArrowDamage: number;

  // --- Nature ---
  flatNatureDamage: number;

  // --- Bleed ---
  firstBleedCardFree: boolean;
  bleedPhysicalBonus: number;
  bleedLeechChance: number;
  bleedExecuteThreshold: number;
  bleedDesperateMultiplier: number;
  bleedPoisonChance: number;
  bleedPoisonDamageTakenBonus: number;
  companionBleedDamageBonus: number;
  receiveHalfBleedDamage: boolean;
  bleedHalvesEnemyHealing: boolean;

  // --- Leech ---
  firstLeechCardDoubled: boolean;
  leechDesperateMultiplier: number;
  leechMissingHealthStep: number;
  leechBleedChance: number;
  leechExecuteMultiplier: number;
  manaOnLeechChance: number;
  trinketSiphonChance: number;
  leechPoisonChance: number;
  blockEnemyLeech: boolean;
  natureLeechChance: number;
};
