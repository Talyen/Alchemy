// Route destination pool and availability rules for run navigation.
// Depends on run tuning constants and alchemy destination types.
import { CAMPFIRE_HP_THRESHOLD, ELITE_HP_THRESHOLD, SHOP_MIN_GOLD } from "@/lib/game-constants";

import { DESTINATIONS, type Destination } from "../types";

// The pool of destinations the player can choose from after each victory.
// Boss Combat is excluded by getAvailableDestinations because final slots inject it.
export const destinationPool: Destination[] = [
  DESTINATIONS.NORMAL_COMBAT,
  DESTINATIONS.ELITE_COMBAT,
  DESTINATIONS.MERCHANT_SHOP,
  DESTINATIONS.ALCHEMIST_SHOP,
  DESTINATIONS.MYSTERY,
  DESTINATIONS.CORRUPTION,
  DESTINATIONS.CAMPFIRE,
  DESTINATIONS.BOSS_COMBAT,
];

// Filters the destination pool to remove inappropriate choices for the current
// game state before navigation fills the final reward route slots.
export function getAvailableDestinations(currentHp: number, currentGold: number, maxHp: number) {
  return destinationPool.filter((d) => {
    if (d === DESTINATIONS.BOSS_COMBAT) return false;
    if (d === DESTINATIONS.CAMPFIRE && currentHp >= Math.floor(maxHp * CAMPFIRE_HP_THRESHOLD)) return false;
    if ((d === DESTINATIONS.MERCHANT_SHOP || d === DESTINATIONS.ALCHEMIST_SHOP) && currentGold < SHOP_MIN_GOLD)
      return false;
    if (d === DESTINATIONS.ELITE_COMBAT && currentHp < Math.floor(maxHp * ELITE_HP_THRESHOLD)) return false;
    return true;
  });
}
