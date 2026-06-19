import type { EnemyStatusValues, PlayerStatusValues, EnemyMitigation, TrinketManifest } from "@/lib/battle";

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
  return {
    forge: 0,
    armor: 0,
    block: 0,
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
