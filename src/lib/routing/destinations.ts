// Run destination labels shared by map generation, navigation, and persistence.
export const DESTINATIONS = {
  NORMAL_COMBAT: "Normal Combat",
  ELITE_COMBAT: "Elite Combat",
  MERCHANT_SHOP: "Merchant's Shop",
  ALCHEMIST_SHOP: "Alchemist's Shop",
  TRINKET_SHOP: "Trinket Shop",
  EQUIPMENT_SHOP: "Equipment Shop",
  MYSTERY: "Mystery",
  CORRUPTION: "Corruption",
  CAMPFIRE: "Campfire",
  BOSS_COMBAT: "Boss Combat",
} as const;

export type Destination = (typeof DESTINATIONS)[keyof typeof DESTINATIONS];
