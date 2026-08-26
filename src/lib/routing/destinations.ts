// Run destination labels shared by map generation, navigation, and persistence.
export const DESTINATIONS = {
  NORMAL_COMBAT: "Normal Combat",
  ELITE_COMBAT: "Elite Combat",
  CARD_SHOP: "Card Shop",
  ALCHEMIST_SHOP: "Alchemist's Shop",
  TRINKET_SHOP: "Trinket Shop",
  EQUIPMENT_SHOP: "Equipment Shop",
  MYSTERY: "Mystery",
  CORRUPTION: "Corruption",
  CAMPFIRE: "Campfire",
  BOSS_COMBAT: "Boss Combat",
} as const;

export type Destination = (typeof DESTINATIONS)[keyof typeof DESTINATIONS];

export const COMBAT_DESTINATIONS = [
  DESTINATIONS.NORMAL_COMBAT,
  DESTINATIONS.ELITE_COMBAT,
  DESTINATIONS.BOSS_COMBAT,
] as const satisfies readonly Destination[];

export const SHOP_DESTINATIONS = [
  DESTINATIONS.CARD_SHOP,
  DESTINATIONS.ALCHEMIST_SHOP,
  DESTINATIONS.TRINKET_SHOP,
  DESTINATIONS.EQUIPMENT_SHOP,
] as const satisfies readonly Destination[];

export function isCombatDestination(destination: Destination): boolean {
  return (COMBAT_DESTINATIONS as readonly Destination[]).includes(destination);
}

export function isShopDestination(destination: Destination): boolean {
  return (SHOP_DESTINATIONS as readonly Destination[]).includes(destination);
}
