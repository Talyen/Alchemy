import type { ContentSystemId } from "./types";
import { CONTENT_SYSTEMS } from "./types";

/** Wildwood does not pay run crystal materials (see commitVictoryRewards); crystal wish becomes gold. */
export function shouldConvertCrystalWishToGold(contentSystemType: ContentSystemId): boolean {
  return contentSystemType === CONTENT_SYSTEMS.WILDWOOD;
}
