// Filters the post-victory destination pool by current run health and gold.
import { CAMPFIRE_HEALTH_THRESHOLD, ELITE_HEALTH_THRESHOLD, SHOP_MIN_GOLD } from "@/lib/game-constants";

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
  return nonBossDestinationPool.filter((destination) => {
    if (destination === DESTINATIONS.CAMPFIRE && currentHealth >= Math.floor(maxHealth * CAMPFIRE_HEALTH_THRESHOLD))
      return false;
    if (isShopDestination(destination) && currentGold < SHOP_MIN_GOLD) return false;
    if (destination === DESTINATIONS.EQUIPMENT_SHOP && !hasAnyOwnedGear) return false;
    if (destination === DESTINATIONS.TRINKET_SHOP && !hasUnownedTrinkets) return false;
    if (destination === DESTINATIONS.ELITE_COMBAT && currentHealth < Math.floor(maxHealth * ELITE_HEALTH_THRESHOLD))
      return false;
    return true;
  });
}
