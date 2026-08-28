import type { ContentSystemId } from "./types";
import { CONTENT_SYSTEMS } from "./types";

export function shouldConvertCrystalWishToGold(contentSystemType: ContentSystemId): boolean {
  return contentSystemType === CONTENT_SYSTEMS.WILDWOOD;
}
