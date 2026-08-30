import type { BestiaryEntry } from "@/lib/game-data";
import type { ContentValidationIssue } from "../types";

export const TRAIT_REQUIRED_PATTERNS: Record<string, { pattern: RegExp; term: string }> = {
  "iron-hide": { pattern: /armor/, term: "armor" },
  "rusting-carapace": { pattern: /forge/, term: "forge" },
  "starting-block": { pattern: /block/, term: "block" },
  "glacial-shell": { pattern: /freeze|burn/, term: "freeze or burn" },
  regeneration: { pattern: /health|heal/, term: "health or heal" },
  "burn-vulnerability": { pattern: /burn/, term: "burn" },
  "brittle-bones": { pattern: /holy|stun/, term: "holy or stun" },
  "trinket-hoarder": { pattern: /burn|trinket/, term: "burn or trinket" },
  "poison-resistance": { pattern: /poison/, term: "poison" },
  "holy-vulnerability": { pattern: /holy/, term: "holy" },
  "living-armor": { pattern: /bleed|armor/, term: "bleed or armor" },
  "gold-trove": { pattern: /gold/, term: "gold" },
  "freeze-vulnerability": { pattern: /freeze/, term: "freeze" },
  amorphous: { pattern: /physical|poison/, term: "physical or poison" },
  "cinder-skin": { pattern: /burn/, term: "burn" },
  "will-o-wisp": { pattern: /physical|freeze/, term: "physical or freeze" },
  bandit: { pattern: /attack|holy/, term: "attack or holy" },
  ogre: { pattern: /physical|block|holy/, term: "physical, block or holy" },
  "fire-imp": { pattern: /burn|freeze/, term: "burn or freeze" },
  hellhound: { pattern: /burn|freeze|damage/, term: "burn, freeze or damage" },
  pyromancer: { pattern: /burn|block|freeze/, term: "burn, block or freeze" },
  "giant-spider": { pattern: /poison|burn/, term: "poison or burn" },
  "giant-snake": { pattern: /poison|block|freeze/, term: "poison, block or freeze" },
  "blood-cultist": { pattern: /bleed|attack|holy/, term: "bleed, attack or holy" },
  "dire-wolf": { pattern: /bleed|physical/, term: "bleed or physical" },
  vampire: { pattern: /leech|health|attack|holy|burn/, term: "leech, health, attack, holy or burn" },
  "blood-countess": { pattern: /holy|bleed/, term: "holy or bleed" },
  "zealot-enemy": { pattern: /holy|bleed/, term: "holy or bleed" },
  cleric: { pattern: /block|holy|health/, term: "block, holy or health" },
  inquisitor: { pattern: /holy|bleed/, term: "holy or bleed" },
  paladin: { pattern: /block|stun|holy/, term: "block, stun or holy" },
  seraph: { pattern: /bleed|holy/, term: "bleed or holy" },
  "winter-wolf": { pattern: /freeze|burn/, term: "freeze or burn" },
  "ice-wraith": { pattern: /frozen|physical|burn|holy/, term: "frozen, physical, burn or holy" },
  yeti: { pattern: /block|frozen|freeze|burn/, term: "block, frozen, freeze or burn" },
  banshee: { pattern: /stun|holy/, term: "stun or holy" },
  brawler: { pattern: /damage|stun|bleed/, term: "damage, stun or bleed" },
  "stone-golem": { pattern: /block|damage/, term: "block or damage" },
  "earth-elemental": { pattern: /block|physical|freeze|burn/, term: "block, physical, freeze or burn" },
  "stone-titan": { pattern: /stun/, term: "stun" },
};

export function validateEnemyTraitDescriptionParity(enemy: BestiaryEntry): ContentValidationIssue[] {
  const issues: ContentValidationIssue[] = [];
  for (const trait of enemy.traits) {
    const config = TRAIT_REQUIRED_PATTERNS[trait.id];
    if (config && !config.pattern.test(trait.description.toLowerCase())) {
      issues.push({
        severity: "error",
        area: "enemies",
        id: enemy.id,
        message: `Trait "${trait.id}" description does not mention ${config.term}`,
      });
    }
  }
  return issues;
}
