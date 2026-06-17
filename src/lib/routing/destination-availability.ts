// Filters the post-victory destination pool by current run health and gold.
import { CAMPFIRE_HEALTH_THRESHOLD, ELITE_HEALTH_THRESHOLD, SHOP_MIN_GOLD } from "@/lib/game-constants";

import { DESTINATIONS, type Destination } from "./destinations";

const GOLD_GATED_SHOPS: Destination[] = [
  DESTINATIONS.MERCHANT_SHOP,
  DESTINATIONS.ALCHEMIST_SHOP,
  DESTINATIONS.TRINKET_SHOP,
  DESTINATIONS.EQUIPMENT_SHOP,
];

export function isGoldGatedShop(destination: Destination): boolean {
  return GOLD_GATED_SHOPS.includes(destination);
}

const destinationPool: Destination[] = [
  DESTINATIONS.NORMAL_COMBAT,
  DESTINATIONS.ELITE_COMBAT,
  DESTINATIONS.MERCHANT_SHOP,
  DESTINATIONS.ALCHEMIST_SHOP,
  DESTINATIONS.TRINKET_SHOP,
  DESTINATIONS.EQUIPMENT_SHOP,
  DESTINATIONS.MYSTERY,
  DESTINATIONS.CORRUPTION,
  DESTINATIONS.CAMPFIRE,
  DESTINATIONS.BOSS_COMBAT,
];

/** Boss Combat is excluded here; act-final slots inject it via run navigation. */
export function getAvailableDestinations(currentHealth: number, currentGold: number, maxHealth: number) {
  return destinationPool.filter((d) => {
    if (d === DESTINATIONS.BOSS_COMBAT) return false;
    if (d === DESTINATIONS.CAMPFIRE && currentHealth >= Math.floor(maxHealth * CAMPFIRE_HEALTH_THRESHOLD)) return false;
    if (isGoldGatedShop(d) && currentGold < SHOP_MIN_GOLD) return false;
    if (d === DESTINATIONS.ELITE_COMBAT && currentHealth < Math.floor(maxHealth * ELITE_HEALTH_THRESHOLD)) return false;
    return true;
  });
}
