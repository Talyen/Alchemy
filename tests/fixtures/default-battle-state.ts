import type {
  PlayerStatusValues,
  EnemyStatusValues,
  EnemyMitigation,
  TrinketManifest,
  CcState,
  CombatFlags,
} from "@/lib/battle";
import { defaultTalentEffects } from "@/lib/battle";

export { defaultTalentEffects };

export function defaultPlayerStatusValues(overrides?: Partial<PlayerStatusValues>): PlayerStatusValues {
  return {
    block: 0,
    stun: 0,
    burn: 0,
    poison: 0,
    bleed: 0,
    freeze: 0,
    forge: 0,
    armor: 0,
    phoenixFeather: false,
    haste: 0,
    ...overrides,
  };
}

export function defaultEnemyStatusValues(overrides?: Partial<EnemyStatusValues>): EnemyStatusValues {
  return {
    block: 0,
    stun: 0,
    burn: 0,
    poison: 0,
    bleed: 0,
    freeze: 0,
    forge: 0,
    armor: 0,
    ...overrides,
  };
}

export function defaultEnemyMitigation(overrides?: Partial<EnemyMitigation>): EnemyMitigation {
  return { forge: 0, armor: 0, block: 0, burnBonus: 0, freezeBonus: 0, ...overrides };
}

export function defaultCcState(overrides?: Partial<CcState>): CcState {
  return { stunSkipTurns: 0, freezeSkipTurns: 0, cooldown: 0, ...overrides };
}

export function defaultCombatFlags(overrides?: Partial<CombatFlags>): CombatFlags {
  return {
    firstPhysicalCardFreeUsed: false,
    firstHolyCardFreeUsed: false,
    firstBurnCardDoubledUsed: false,
    firstArmorCardDoubledUsed: false,
    firstPoisonCardFreeUsed: false,
    firstBleedCardFreeUsed: false,
    nextCardCostReduction: 0,
    goldOnFirstPoisonThisCombat: false,
    firstHolyDamageBonusUsed: false,
    firstBurnTrinketDoubledUsed: false,
    firstHarmfulStatusPrevented: false,
    firstPotionFreeUsed: false,
    firstLeechCardDoubledUsed: false,
    resonantChimeUsedThisTurn: false,
    runicQuillUsedThisTurn: false,
    divineAegisTriggered: false,
    ...overrides,
  };
}

export function defaultTrinketManifest(overrides?: Partial<TrinketManifest>): TrinketManifest {
  return {
    extraDrawPerBattle: 0,
    firstHolyDamageDoubled: false,
    firstBurnDoubled: false,
    boneCharmHealOnKill: 0,
    forgeStunThreshold: 0,
    forgeStunAmount: 0,
    frozenHeartDamage: 0,
    blockToArmorThreshold: 0,
    blockToArmorAmount: 0,
    runicQuillDrawOnConsume: 0,
    sinEaterHealOnHarmfulStatusRemove: 0,
    vanguardCrestForgeOnBlockAbsorb: 0,
    parasiticBloomLeechChance: 0,
    cutpurseGoldOnBleed: 0,
    wishingWellGoldOnWish: 0,
    plagueDoctorImmunity: false,
    mortarPestleFreeFirstPotion: false,
    sunderingArmorPiercing: 0,
    resonantChimeCardsRequired: 0,
    resonantChimeMana: 0,
    smugglersMapGoldBonus: 0,
    grovesFavorStartHeal: 0,
    merchantsFavorDiscount: 0,
    companionDamageBonus: 0,
    freezeDurationExtension: 0,
    thunderstoneDamageOnStun: 0,
    chippedAmuletStunOnBlock: 0,
    luckyCloverGoldChance: 0,
    hornAmuletCounterOnHeal: 0,
    crystalAmuletCrystalHarvest: 0,
    charredAmuletHealOnBurn: 0,
    direAmuletExtraEnemyStatus: 0,
    dungeonCandleDrawAfterResist: 0,
    volatileAmuletExplosionOnKill: 0,
    shatteredAmuletDamageOnStun: 0,
    venomAmuletExtraPoisonCount: 0,
    manaBerryHealOnBurn: 0,
    manaBerryHealOnPoison: 0,
    manaBerryHealOnBleed: 0,
    manaBerryHealOnFreeze: 0,
    manaBerryHealOnStun: 0,
    frostberryFreezeOnCrit: 0,
    blessedBerryChipDamage: 0,
    shadowBerryLeechOnKill: 0,
    magicBeanExtraGold: 0,
    scryingOrbExtraWish: 0,
    phoenixFeatherRevives: 0,
    ...overrides,
  };
}
