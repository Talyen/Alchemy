import type { CompanionId } from "./types";

export interface HealthThresholdBonus {
  threshold: number;
  amount: number;
}

export interface TalentEffectManifest {
  flatPhysicalDamage: number;
  armorToPhysicalDamage: boolean;
  physicalStunChance: number;
  physicalBleedChance: number;
  physicalDetonatesBleed: boolean;
  physicalDoubledBelowHalfHealth: boolean;
  physicalDoubledVsStunned: boolean;
  physicalDoubledVsFrozen: boolean;
  blockToPhysicalDamageMultiplier: number;
  forgeToPhysicalDamageMultiplier: number;
  physicalOnDodgeEqualToAttack: boolean;

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

  startBlock: number;
  blockPreventsBleed: boolean;
  blockPreventsPoison: boolean;
  blockPreventsStun: boolean;
  blockAbsorbPhysicalBonus: number;
  blockReduceBurnDamage: number;
  blockDepletedHeal: number;
  blockToHolyDamage: boolean;
  blockToStunDamage: boolean;
  blockOnDodgeEqualToAttack: boolean;

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

  armorMitigatesBurn: boolean;
  armorBlockThreshold: number;
  armorBlockAmount: number;
  armorDoubledBelowHalfHealth: boolean;
  firstArmorCardDoubled: boolean;
  startArmor: number;
  armorMitigatesBleed: boolean;
  armorBreakBlock: number;
  armorCleanseThreshold: number;
  flatArmorAmount: number;

  campfireHealBonus: number;
  healthThresholdBlock: HealthThresholdBonus | null;
  maxHealthPerCombat: number;
  startHealth: number;
  healMultiplier: number;
  consumeHealMultiplier: number;
  healthThresholdArmor: HealthThresholdBonus[];
  overhealToBlockRatio: number;
  healOnStatusCleanse: number;
  deathsDoorExtension: number;
  damageReduction: number;
  dodgeChanceBelowHalfHealth: number;
  burnDamageReduction: number;
  freezeDamageReduction: number;
  natureDamageReduction: number;

  firstBurnCardBonusMultiplier: number;
  burnRemovesEnemyArmor: boolean;
  burnDoubleChance: number;
  receiveHalfBurnDamage: boolean;
  flatBurnDamage: number;
  burnOnWish: number;
  forgeOnBurnDealt: number;
  blockToBurnDamage: boolean;
  burnStunChance: number;

  consumeBurnDamageBonusPercent: number;
  firstConsumeCardFree: boolean;
  consumeDamageBonusPercent: number;
  healOnConsume: number;
  goldOnConsume: number;
  drawOnConsume: number;
  poisonOnConsume: number;
  blockOnConsume: number;

  shopCardDiscount: number;
  shopFreeRefresh: boolean;
  startGold: number;
  goldPerCombat: number;
  goldOnDodge: number;
  potionDiscount: number;
  potionPotency: number;
  potionMixPotency: number;
  removeCardDiscount: number;
  enemyGoldDropBonus: number;
  eliteGoldDropBonus: number;
  goldOnWish: number;
  mixPotionDiscount: number;

  companionBondLevels: Record<CompanionId, number>;

  holyLifestealPercent: number;
  firstHolyCardFree: boolean;
  holyGoldPercent: number;
  holyBurnChance: number;
  receiveHalfHolyDamage: boolean;
  holyWishChance: number;
  holyBlockPercentFromDamage: number;
  holyVsBurnMultiplier: number;
  holyGoldChance: number;

  wishUndiscoveredCards: boolean;
  healthOnWish: number;
  removeHarmfulStatusOnWish: boolean;
  wishExtraChoiceChance: number;
  wishDrawsCard: boolean;
  manaOnWish: number;
  wishTrinketChoice: boolean;
  wishBlockBelowHealthPct: number;
  wishBlockAmount: number;
  wishCardsUpgraded: boolean;

  runMaxHealthBonus: number;
  runMaxManaBonus: number;
  cardHealBonus: Record<string, number>;

  poisonDamageReduction: number;
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
  poisonPreventsEnemyDodge: boolean;

  companionDamage: number;
  companionGoldFindActive: boolean;
  companionLeechChance: number;
  drawOnCompanionCard: number;
  companionDoubledVsLowHealth: boolean;
  damageReductionWithCompanion: number;
  blockOnCompanionDamage: number;
  companionStunChance: number;
  firstCompanionCardFree: boolean;
  companionAttacksOnDodge: boolean;

  wishCrystalGold: number;

  startMana: number;
  wellspringKeepMana: number;
  manaBulwarkActive: boolean;
  manaShellActive: boolean;

  burnDamagePerManaCrystal: number;
  freezeDamagePerManaCrystal: number;
  burnDamageOnManaCrystalLoss: number;
  companionDamagePerManaCrystal: number;
  healOnManaGain: number;

  freezeThresholdReduction: number;
  freezeDoubleDamage: boolean;
  blockOnFreeze: number;
  freezeStripArmor: boolean;
  startFreeze: number;
  companionVsFrozenBonus: number;
  freezePreventsPoisonDecay: boolean;
  freezeBlocksRegen: boolean;
  freezePreventsEnemyScaling: boolean;
  freezeStripBlock: boolean;
  freezePreventsEnemyDodge: boolean;
  receiveHalfFreezeDamage: boolean;
  flatFreezeDamage: number;

  flatArrowDamage: number;
  archeryPlayTwiceChance: number;
  archeryDoubledVsStunned: boolean;
  archeryDoubledVsFrozen: boolean;
  archeryDoubledVsHighHealth: boolean;
  archeryArmorPiercing: number;
  firstArcheryCardFree: boolean;
  archeryDoubledVsLowHealth: boolean;
  archeryBleedChance: number;
  goldOnArcheryKill: number;
  nextArcheryCardFreeOnDodge: boolean;

  flatNatureDamage: number;
  naturePoisonChance: number;
  natureBleedChance: number;
  natureBonusVsPoisoned: number;
  receiveHalfNatureDamage: boolean;
  natureStunChance: number;
  armorToNatureDamage: boolean;
  blockOnNatureCard: number;
  healOnNatureCard: number;
  nextNatureCardFreeOnDodge: boolean;

  firstBleedCardFree: boolean;
  bleedPhysicalBonus: number;
  bleedLeechChance: number;
  bleedExecuteThreshold: number;
  bleedExecuteMultiplier: number;
  bleedDesperateMultiplier: number;
  bleedPoisonChance: number;
  bleedPoisonDamageTakenBonus: number;
  companionBleedDamageBonus: number;
  receiveHalfBleedDamage: boolean;
  bleedHalvesEnemyHealing: boolean;
  partingCutOnDodge: boolean;

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
}
