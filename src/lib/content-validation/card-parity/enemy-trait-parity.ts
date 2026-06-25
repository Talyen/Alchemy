import type { BestiaryEntry } from "@/lib/game-data";
import type { ContentValidationIssue } from "../types";

const TRAIT_REQUIRED_PATTERNS: Record<string, { pattern: RegExp; term: string }> = {
  "iron-hide": { pattern: /armor/, term: "armor" },
  "rusting-carapace": { pattern: /forge/, term: "forge" },
  "glacial-shell": { pattern: /freeze|burn/, term: "freeze or burn" },
  regeneration: { pattern: /health|heal/, term: "health or heal" },
  "brittle-bones": { pattern: /holy|stun/, term: "holy or stun" },
  "trinket-hoarder": { pattern: /burn|trinket/, term: "burn or trinket" },
  "burn-resistance": { pattern: /burn/, term: "burn" },
  "poison-resistance": { pattern: /poison/, term: "poison" },
  "holy-vulnerability": { pattern: /holy/, term: "holy" },
  "living-armor": { pattern: /bleed|armor/, term: "bleed or armor" },
  "gold-trove": { pattern: /gold/, term: "gold" },
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
