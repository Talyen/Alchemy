import { ELITE_HEALTH_THRESHOLD, SHOP_MIN_GOLD } from "@/lib/game-constants";

import { DESTINATIONS, isShopDestination, type Destination } from "./destinations";

const nonBossDestinationPool: Destination[] = (Object.values(DESTINATIONS) as Destination[]).filter(
  (destination) => destination !== DESTINATIONS.BOSS_COMBAT,
);

export function getAvailableDestinations(
  currentHealth: number,
  currentGold: number,
  maxHealth: number,
  hasAnyOwnedGear = true,
  hasUnownedTrinkets = true,
): Destination[] {
  const eliteFloor = Math.round(maxHealth * ELITE_HEALTH_THRESHOLD);
  const shopsAffordable = currentGold >= SHOP_MIN_GOLD;
  return nonBossDestinationPool.filter((destination) => {
    if (destination === DESTINATIONS.ELITE_COMBAT) return currentHealth >= eliteFloor;
    if (isShopDestination(destination)) {
      if (!shopsAffordable) return false;
      if (destination === DESTINATIONS.GEAR_SHOP && !hasAnyOwnedGear) return false;
      if (destination === DESTINATIONS.TRINKET_SHOP && !hasUnownedTrinkets) return false;
    }
    return true;
  });
}
