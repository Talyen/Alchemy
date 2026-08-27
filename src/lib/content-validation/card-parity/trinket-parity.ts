import { isTrinketId, type TrinketEntry, type TrinketId } from "@/lib/game-data";
import type { ContentValidationIssue } from "../types";

export const TRINKET_REQUIRED_PATTERNS: Record<TrinketId, { pattern: RegExp; term: string }> = {
  "brass-censer": { pattern: /holy/, term: "holy" },
  "tattered-pages": { pattern: /draw|additional|card/, term: "draw/card" },
  meteorite: { pattern: /burn/, term: "burn" },
  "bone-charm": { pattern: /health|heal/, term: "health or heal" },
  "obsidian-hammer": { pattern: /forge.*stun|stun.*forge/, term: "forge and stun" },
  "icy-heart": { pattern: /freeze.*damage|damage.*freeze/, term: "freeze and damage" },
  "ironwood-buckler": { pattern: /block.*armor|armor.*block/, term: "block and armor" },
  "runic-quill": { pattern: /consume|draw/, term: "consume or draw" },
  "sin-eaters-lantern": { pattern: /health|heal/, term: "health or heal" },
  "vanguards-crest": { pattern: /forge|block/, term: "forge or block" },
  "parasitic-bloom": { pattern: /poison|leech/, term: "poison or leech" },
  "cutpurse-knife": { pattern: /bleed.*gold|gold.*bleed/, term: "bleed and gold" },
  "wishing-well-coin": { pattern: /wish.*gold|gold.*wish/, term: "wish and gold" },
  "merchants-favor": { pattern: /purchase|shop|gold|less/, term: "shop discount" },
  "plague-doctors-mask": { pattern: /immune|harmful.*status/, term: "immunity to harmful status" },
  "mortar-and-pestle": { pattern: /potion|free/, term: "free potion" },
  "sundering-charm": { pattern: /armor/, term: "armor" },
  "resonant-chimes": { pattern: /cards.*mana|mana.*cards/, term: "cards and mana" },
  "smugglers-map": { pattern: /gold/, term: "gold" },
  "groves-favor": { pattern: /health|heal|restore/, term: "health/heal/restore" },
  "companions-collar": { pattern: /companion.*damage|damage.*companion/, term: "companion damage" },
  "frozen-pocketwatch": { pattern: /freeze/, term: "freeze" },
  thunderstone: { pattern: /stun/, term: "stun" },
  "lucky-clover": { pattern: /nature|gold|chance/, term: "nature, gold, or chance" },
};

export function validateTrinketDescriptionParity(trinket: TrinketEntry): ContentValidationIssue[] {
  const issues: ContentValidationIssue[] = [];
  const config = isTrinketId(trinket.id) ? TRINKET_REQUIRED_PATTERNS[trinket.id] : undefined;
  const prose = trinket.descriptionLines.join(" ").toLowerCase();

  if (!config) {
    issues.push({
      severity: "error",
      area: "trinkets",
      id: trinket.id,
      message: `Trinket "${trinket.id}" has no registered description parity pattern`,
    });
    return issues;
  }

  if (!config.pattern.test(prose)) {
    issues.push({
      severity: "error",
      area: "trinkets",
      id: trinket.id,
      message: `Trinket "${trinket.id}" description does not mention ${config.term}`,
    });
  }

  return issues;
}
