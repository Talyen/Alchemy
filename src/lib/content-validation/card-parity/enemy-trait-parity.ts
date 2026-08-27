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
