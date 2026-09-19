import type { BestiaryEntry } from "@/lib/game-data";
import type { ContentValidationIssue } from "../types";

// Each trait lists the terms its description must mention; the matcher derives
// the pattern from the same list so the two cannot drift apart.
const TRAIT_REQUIRED_TERMS: Record<string, string[]> = {
  "glacial-body": ["freeze", "burn"],
  "minor-freeze-vulnerability": ["freeze"],
  "cold-blooded": ["freeze"],
  "minor-holy-vulnerability": ["holy"],
  "tough-hide": ["physical"],
  "vampiric-curse": ["holy", "burn"],
  "frozen-apparition": ["physical", "burn", "holy"],
  "winter-hide": ["freeze", "burn"],
  "earthen-body": ["freeze", "burn"],
  "frost-elemental": ["freeze"],
  "iron-hide": ["armor"],
  "rusting-carapace": ["forge"],
  "starting-block": ["block"],
  "glacial-shell": ["freeze"],
  regeneration: ["health", "heal"],
  "burn-vulnerability": ["burn"],
  "brittle-bones": ["stun"],
  "poison-resistance": ["poison"],
  "holy-vulnerability": ["holy"],
  "living-armor": ["bleed", "armor"],
  "gold-trove": ["gold"],
  "freeze-vulnerability": ["freeze"],
  amorphous: ["physical", "poison"],
  "cinder-skin": ["burn"],
  "will-o-wisp": ["physical", "freeze"],
  bandit: ["attack"],
  ogre: ["physical", "block"],
  "fire-imp": ["burn"],
  hellhound: ["burn"],
  pyromancer: ["burn"],
  "giant-spider": ["poison"],
  "giant-snake": ["poison", "block"],
  "blood-cultist": ["bleed"],
  "dire-wolf": ["bleed"],
  vampire: ["bleed", "health"],
  "blood-countess": ["holy", "bleed"],
  "zealot-enemy": ["holy", "forge"],
  cleric: ["block", "holy", "health"],
  inquisitor: ["holy", "burn"],
  paladin: ["block", "stun", "holy"],
  seraph: ["holy", "health"],
  "winter-wolf": ["freeze"],
  "ice-wraith": ["freeze"],
  yeti: ["block", "frozen"],
  banshee: ["purge"],
  brawler: ["damage", "stun"],
  "stone-golem": ["block", "damage"],
  "earth-elemental": ["block", "physical"],
  "stone-titan": ["stun"],
};

export const TRAIT_REQUIRED_PATTERNS: Record<string, { pattern: RegExp; term: string }> = Object.fromEntries(
  Object.entries(TRAIT_REQUIRED_TERMS).map(([id, terms]) => [
    id,
    { pattern: new RegExp(terms.join("|")), term: terms.join(" or ") },
  ]),
);

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
