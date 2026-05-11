// Route destination pool and availability rules for run navigation.
// Depends on run tuning constants and alchemy destination types.
import { CAMPFIRE_HP_THRESHOLD, ELITE_HP_THRESHOLD, SHOP_MIN_GOLD } from "@/lib/game-constants";

import type { Destination } from "../types";

// The pool of destinations the player can choose from after each victory.
// Boss Combat is excluded by getAvailableDestinations because final slots inject it.
export const destinationPool: Destination[] = [
  "Normal Combat", "Elite Combat", "Merchant's Shop", "Alchemist's Shop", "Mystery", "Campfire", "Boss Combat",
];

// Filters the destination pool to remove inappropriate choices for the current
// game state before navigation fills the final reward route slots.
export function getAvailableDestinations(currentHp: number, currentGold: number, maxHp: number) {
  const halfHp = Math.floor(maxHp * ELITE_HP_THRESHOLD);
  return destinationPool.filter((d) => {
    if (d === "Boss Combat") return false;
    if (d === "Campfire" && currentHp >= Math.floor(maxHp * CAMPFIRE_HP_THRESHOLD) && currentHp >= halfHp) return false;
    if ((d === "Merchant's Shop" || d === "Alchemist's Shop") && currentGold < SHOP_MIN_GOLD) return false;
    if (d === "Elite Combat" && currentHp < halfHp) return false;
    return true;
  });
}
