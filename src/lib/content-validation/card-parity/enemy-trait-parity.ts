import type { BestiaryEntry } from "@/lib/game-data";
import type { ContentValidationIssue } from "../types";

export const TRAIT_REQUIRED_PATTERNS: Record<string, { pattern: RegExp; term: string }> = {
  "glacial-body": { pattern: /freeze|burn/, term: "freeze or burn" },
  "minor-freeze-vulnerability": { pattern: /freeze/, term: "freeze" },
  "cold-blooded": { pattern: /freeze/, term: "freeze" },
  "minor-holy-vulnerability": { pattern: /holy/, term: "holy" },
  "tough-hide": { pattern: /physical/, term: "physical" },
  "vampiric-curse": { pattern: /holy|burn/, term: "holy or burn" },
  "frozen-apparition": { pattern: /physical|burn|holy/, term: "physical or burn or holy" },
  "winter-hide": { pattern: /freeze|burn/, term: "freeze or burn" },
  "earthen-body": { pattern: /freeze|burn/, term: "freeze or burn" },
  "frost-elemental": { pattern: /freeze/, term: "freeze" },
  "iron-hide": { pattern: /armor/, term: "armor" },
  "rusting-carapace": { pattern: /forge/, term: "forge" },
  "starting-block": { pattern: /block/, term: "block" },
  "glacial-shell": { pattern: /freeze/, term: "freeze" },
  regeneration: { pattern: /health|heal/, term: "health or heal" },
  "burn-vulnerability": { pattern: /burn/, term: "burn" },
  "brittle-bones": { pattern: /stun/, term: "stun" },
  "poison-resistance": { pattern: /poison/, term: "poison" },
  "holy-vulnerability": { pattern: /holy/, term: "holy" },
  "living-armor": { pattern: /bleed|armor/, term: "bleed or armor" },
  "gold-trove": { pattern: /gold/, term: "gold" },
  "freeze-vulnerability": { pattern: /freeze/, term: "freeze" },
  amorphous: { pattern: /physical|poison/, term: "physical or poison" },
  "cinder-skin": { pattern: /burn/, term: "burn" },
  "will-o-wisp": { pattern: /physical|freeze/, term: "physical or freeze" },
  bandit: { pattern: /attack/, term: "attack" },
  ogre: { pattern: /physical|block/, term: "physical or block" },
  "fire-imp": { pattern: /burn/, term: "burn" },
  hellhound: { pattern: /burn/, term: "burn" },
  pyromancer: { pattern: /burn/, term: "burn" },
  "giant-spider": { pattern: /poison/, term: "poison" },
  "giant-snake": { pattern: /poison|block/, term: "poison or block" },
  "blood-cultist": { pattern: /bleed/, term: "bleed" },
  "dire-wolf": { pattern: /bleed/, term: "bleed" },
  vampire: { pattern: /bleed|health/, term: "bleed or health" },
  "blood-countess": { pattern: /holy|bleed/, term: "holy or bleed" },
  "zealot-enemy": { pattern: /holy|forge/, term: "holy or forge" },
  cleric: { pattern: /block|holy|health/, term: "block, holy or health" },
  inquisitor: { pattern: /holy|burn/, term: "holy or burn" },
  paladin: { pattern: /block|stun|holy/, term: "block, stun or holy" },
  seraph: { pattern: /holy|health/, term: "holy or health" },
  "winter-wolf": { pattern: /freeze/, term: "freeze" },
  "ice-wraith": { pattern: /freeze/, term: "freeze" },
  yeti: { pattern: /block|frozen/, term: "block or frozen" },
  banshee: { pattern: /purge/, term: "purge" },
  brawler: { pattern: /damage|stun/, term: "damage or stun" },
  "stone-golem": { pattern: /block|damage/, term: "block or damage" },
  "earth-elemental": { pattern: /block|physical/, term: "block or physical" },
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
