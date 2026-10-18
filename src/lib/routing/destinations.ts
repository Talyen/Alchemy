export const DESTINATIONS = {
  NORMAL_COMBAT: "Normal Combat",
  ELITE_COMBAT: "Elite Combat",
  CARD_SHOP: "Card Shop",
  ALCHEMIST_SHOP: "Alchemist's Shop",
  TRINKET_SHOP: "Trinket Shop",
  GEAR_SHOP: "Gear Shop",
  MYSTERY: "Mystery",
  CORRUPTION: "Corruption",
  TRANSMUTATION: "Transmutation",
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
  DESTINATIONS.GEAR_SHOP,
] as const satisfies readonly Destination[];

const COMBAT_SET: ReadonlySet<Destination> = new Set(COMBAT_DESTINATIONS);
const SHOP_SET: ReadonlySet<Destination> = new Set(SHOP_DESTINATIONS);

export function isCombatDestination(destination: Destination): boolean {
  return COMBAT_SET.has(destination);
}

export function isShopDestination(destination: Destination): boolean {
  return SHOP_SET.has(destination);
}

export function destinationLabel(destination: Destination): string {
  if (destination === DESTINATIONS.NORMAL_COMBAT) return "Combat";
  if (destination === DESTINATIONS.BOSS_COMBAT) return "Boss";
  return destination;
}
